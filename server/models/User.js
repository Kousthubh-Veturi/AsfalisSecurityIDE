const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  githubId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  avatarUrl: {
    type: String
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String
  },
  tokenExpiry: {
    type: Date
  },
  repositories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository'
  }],
  settings: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    scanOnPush: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Index for fast lookups
userSchema.index({ githubId: 1 });
userSchema.index({ username: 1 });

module.exports = mongoose.model('User', userSchema);
