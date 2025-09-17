const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    // Check if token starts with 'Bearer '
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Check if user still exists and token is valid
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ error: 'Token is not valid' });
      }

      // Check if GitHub token is expired
      if (user.tokenExpiry && user.tokenExpiry < new Date()) {
        return res.status(401).json({ error: 'GitHub token expired, please re-authenticate' });
      }

      // Add user info to request
      req.user = {
        userId: decoded.userId,
        githubId: decoded.githubId,
        accessToken: user.accessToken
      };

      next();
    } catch (err) {
      return res.status(401).json({ error: 'Token is not valid' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Server error in authentication' });
  }
};

module.exports = auth;
