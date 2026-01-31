const jwt = require('jsonwebtoken');
const con = require('../config/db');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from HTTP-only cookie
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Database Check-in (Recommended for Finance/Auctions)
    // Also check user status to block banned users
    const userCheck = await con.query(
      "SELECT id, role, status FROM users WHERE id = $1",
      [decoded.id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(401).json({ message: "User no longer exists." });
    }

    const user = userCheck.rows[0];

    // Block banned or suspended users
    if (user.status === 'banned') {
      return res.status(403).json({
        message: 'Your account has been banned. Please contact support.'
      });
    }

    req.user = decoded;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please login again.' });
    }
    return res.status(403).json({ message: 'Invalid token.' });
  }
};

module.exports = authMiddleware;
