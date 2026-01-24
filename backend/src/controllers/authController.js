const con = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  try {
    const { username, email, password, balance, full_name } = req.body;

    // Basic validation
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const input_query = `
      INSERT INTO users (username, email, password_hash, balance, full_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email
    `;

    const result = await con.query(input_query, [
      username,
      email,
      hashedPassword,
      balance || 0,
      full_name
    ]);

    console.log('Register successful');

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
    });

  } catch (err) {
    console.error(err);
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
  }
};

const login = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if ((!username && !email) || !password) {
      res.status(400).json({ message: 'All required fields must be provided' });
    }
    const fetch_query = "SELECT id, username, email, password_hash, balance, full_name FROM users WHERE username=$1 OR email=$2";

    const result = await con.query(fetch_query, [username, email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'mismatched credentials' });
    }

    const isMatch = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'mismatched credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: result.rows[0].id,
        email: result.rows[0].email,
        username: result.rows[0].username
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { password_hash, ...userData } = result.rows[0];

    res.cookie('token', token, {
      httpOnly: true,           // Prevents XSS attacks
      secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
      sameSite: 'strict',       // Prevents CSRF
      maxAge: 60 * 60 * 1000    // 1 hour in milliseconds
    });

    res.status(200).json({
      message: 'Login successful',
      user: userData
       // Note: token is in cookie, not body
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
};

const logout=async(req,res)=>{
     res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    });
     res.status(200).json({message:'Logged out successfully'})
} 

module.exports = { register, login,logout };
