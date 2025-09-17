const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  githubId: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  private: {
    type: Boolean,
    default: false
  },
  defaultBranch: {
    type: String,
    default: 'main'
  },
  monitoredBranches: [{
    name: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    lastScannedCommit: {
      type: String
    },
    webhookId: {
      type: Number
    }
  }],
  scanSettings: {
    enabledRules: [{
      type: String
    }],
    severityThreshold: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    excludePatterns: [{
      type: String
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for fast lookups
repositorySchema.index({ owner: 1, githubId: 1 });
repositorySchema.index({ fullName: 1 });

module.exports = mongoose.model('Repository', repositorySchema);
