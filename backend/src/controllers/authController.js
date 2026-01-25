const con = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  const client = await con.connect(); // Use dedicated client for transaction safety
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    await client.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);

    const input_query = `
      INSERT INTO users (username, email, password_hash, balance, full_name, version)
      VALUES ($1, $2, $3, 0, $4, 1) -- Initialize version at 1
      RETURNING id, username, email, full_name, balance
    `;

    const result = await client.query(input_query, [username, email, hashedPassword, full_name]);
    
    await client.query('COMMIT');

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
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

    if ((!username && !email) || !password) {
      return res.status(400).json({ message: 'All required fields must be provided' }); // Fixed: Added return
    }

    const fetch_query = "SELECT id, username, email, password_hash, balance, full_name, version FROM users WHERE username=$1 OR email=$2";
    const result = await con.query(fetch_query, [username, email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' }); // Security: Don't tell them if it was the email or password that was wrong
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Explicitly define what to send back
    const responseData = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      balance: user.balance
    };

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 1000
    });

    res.status(200).json({ message: 'Login successful', user: responseData });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
};

const logout = async (req, res) => {
    // We clear the cookie using the exact same configuration used to set it
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'strict',
        path: '/' // Ensure the path matches where the cookie was set
    });

    res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = { register, login,logout };
