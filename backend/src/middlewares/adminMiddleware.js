const jwt = require('jsonwebtoken');
const con=require('../config/db');

const roleMiddleware = async(req, res, next) => {
  try {
    // 1. The 'user' object is attached to 'req' by your previous authMiddleware
    const user = req.user; 

    if (!user) {
        return res.status(401).json({ message: "Authentication required" });
    }

    // 2. Check the role stored inside the verified JWT
    if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied: Admins only" });
    }

    next();
    
  } catch (err) {
    return res.status(403).json({ message:"Invalid User"});
  }
};

module.exports = roleMiddleware;