const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * @route   GET /api/auth/github
 * @desc    Redirect to GitHub OAuth
 * @access  Public
 */
router.get('/github', (req, res) => {
  const scope = 'repo,user:email,admin:repo_hook';
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=${scope}&state=${generateState()}`;
  res.redirect(githubAuthUrl);
});

/**
 * @route   POST /api/auth/callback
 * @desc    Handle GitHub OAuth callback
 * @access  Public
 */
router.post('/callback', async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: code
    }, {
      headers: {
        'Accept': 'application/json'
      }
    });

    const { access_token, refresh_token } = tokenResponse.data;

    if (!access_token) {
      return res.status(400).json({ error: 'Failed to obtain access token' });
    }

    // Get user information from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${access_token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const githubUser = userResponse.data;

    // Get user email (may be private)
    const emailResponse = await axios.get('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `token ${access_token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const primaryEmail = emailResponse.data.find(email => email.primary)?.email || githubUser.email;

    // Create or update user in database
    let user = await User.findOne({ githubId: githubUser.id.toString() });

    if (user) {
      // Update existing user
      user.username = githubUser.login;
      user.email = primaryEmail;
      user.avatarUrl = githubUser.avatar_url;
      user.accessToken = access_token;
      user.refreshToken = refresh_token;
      user.tokenExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    } else {
      // Create new user
      user = new User({
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        email: primaryEmail,
        avatarUrl: githubUser.avatar_url,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000)
      });
    }

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, githubId: user.githubId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        githubId: user.githubId
      }
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ 
      error: 'Authentication failed', 
      message: error.response?.data?.error_description || error.message 
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-accessToken -refreshToken');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      githubId: user.githubId,
      settings: user.settings
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', auth, (req, res) => {
  // For JWT, we can't invalidate the token on server side
  // The client should remove the token from storage
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * @route   PUT /api/auth/settings
 * @desc    Update user settings
 * @access  Private
 */
router.put('/settings', auth, async (req, res) => {
  try {
    const { emailNotifications, scanOnPush } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (typeof emailNotifications === 'boolean') {
      user.settings.emailNotifications = emailNotifications;
    }
    if (typeof scanOnPush === 'boolean') {
      user.settings.scanOnPush = scanOnPush;
    }

    await user.save();

    res.json({
      success: true,
      settings: user.settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Helper function to generate random state for OAuth
function generateState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

module.exports = router;
