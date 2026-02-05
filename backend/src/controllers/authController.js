const con = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserRepo = require('../repositories/userRepository');
const { emitNewUser } = require('../webSocket/socketServer');
const crypto=require('crypto');

const register = async (req, res) => {
  const client = await con.connect();
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    await client.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);

    // Use repository instead of direct query
    const user = await UserRepo.createUser(client, {
      username,
      email,
      password_hash: hashedPassword,
      full_name
    });

    await client.query('COMMIT');

    emitNewUser(user);

    res.status(201).json({
      message: 'User registered successfully',
      user
    });

  } catch (err) {
    await client.query('ROLLBACK');

    // PostgreSQL unique constraint violation error code
    if (err.code === '23505') {
      if (err.constraint === 'users_email_key') {
        return res.status(409).json({ message: 'Email is already registered' });
      }
      if (err.constraint === 'users_username_key') {
        return res.status(409).json({ message: 'Username is already taken' });
      }
      return res.status(409).json({ message: 'Email or username already exists' });
    }

    res.status(500).json({ message: 'Failed to register user' });
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Accept either username or email (frontend may send as 'email' field)
    const identifier = username || email;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Use repository instead of direct query
    const user = await UserRepo.getUserByUsernameOrEmail(con, identifier);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is banned or suspended
    if (user.status === 'banned') {
      return res.status(403).json({
        message: 'Your account has been banned. Please contact support.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

         // ... validation & password check passed ...

    // 1. Generate Tokens
    const accessToken = jwt.sign(
      { id: user.id, role: user.role }, // Payload
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // Short life!
    );
    
    // Random secure string for refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');

    // 2. Store Refresh Token Hash in DB
    // (Hashes are safer if DB is compromised)
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 Days

    await con.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshHash, expiresAt]
    );

    // 3. Set TWO Cookies
    // Access Token Cookie (15 mins)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000, // 15 mins
      sameSite: 'lax'
    });

    // Refresh Token Cookie (7 days) - Path restricted for extra security
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh', // Only sent to refresh endpoint!
      sameSite: 'lax'
    });

    res.json({
      message: 'Login successful',
      user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
    });

    
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to login' });
  }
};

const logout = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (refreshToken) {
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await con.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [refreshHash]);
  }
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ message: 'Logout successful' });
};

const getMe = async (req, res) => {
  try {
    const user_id = req.user.id;

    // Use repository instead of direct query
    const user = await UserRepo.getUserById(con, user_id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        balance: user.balance,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch user data' });
  }
};

// Admin only: Get all users with pagination
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Use repository for both queries
    const users = await UserRepo.getAllUsers(con, limit, offset);
    const totalItems = await UserRepo.getUserCount(con);

    res.json({
      message: 'Users fetched successfully',
      data: users,
      pagination: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Admin only: Ban user
const banUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await UserRepo.updateUserStatus(con, userId, 'banned');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User banned successfully',
      user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to ban user' });
  }
};

// Admin only: Unban user
const unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await UserRepo.updateUserStatus(con, userId, 'active');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User unbanned successfully',
      user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to unban user' });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    // Hash it to verify against DB
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Check DB
    const result = await con.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [refreshHash]
    );

    if (result.rows.length === 0) {
      // Token invalid or expired -> Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      return res.status(401).json({ message: 'Invalid token' });
    }

    const tokenRecord = result.rows[0];
    const userResult = await con.query('SELECT id, role FROM users WHERE id = $1', [tokenRecord.user_id]);
    const user = userResult.rows[0];

    // Issue NEW Access Token
    const newAccessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000,
      sameSite: 'strict'
    });

    res.json({ message: 'Token refreshed' });

  } catch (err) {
    console.error('Refresh Error:', err);
    res.status(500).json({ message: 'Refresh failed' });
  }
};

module.exports = { register, login, logout, getMe, getAllUsers, banUser, unbanUser, refresh };
