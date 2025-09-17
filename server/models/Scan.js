const mongoose = require('mongoose');

const scanResultSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  file: {
    type: String,
    required: true
  },
  line: {
    type: Number,
    required: true
  },
  column: {
    type: Number,
    default: 1
  },
  codeSnippet: {
    type: String
  },
  suggestion: {
    type: String
  },
  category: {
    type: String,
    enum: ['injection', 'xss', 'crypto', 'auth', 'config', 'other'],
    default: 'other'
  }
});

const scanSchema = new mongoose.Schema({
  repository: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true
  },
  branch: {
    type: String,
    required: true
  },
  commitHash: {
    type: String,
    required: true
  },
  triggerType: {
    type: String,
    enum: ['manual', 'webhook', 'scheduled'],
    default: 'manual'
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  duration: {
    type: Number // in milliseconds
  },
  results: [scanResultSchema],
  summary: {
    totalIssues: {
      type: Number,
      default: 0
    },
    criticalCount: {
      type: Number,
      default: 0
    },
    highCount: {
      type: Number,
      default: 0
    },
    mediumCount: {
      type: Number,
      default: 0
    },
    lowCount: {
      type: Number,
      default: 0
    },
    filesScanned: {
      type: Number,
      default: 0
    },
    linesOfCode: {
      type: Number,
      default: 0
    }
  },
  errorMessage: {
    type: String
  },
  scannerVersion: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for performance
scanSchema.index({ repository: 1, createdAt: -1 });
scanSchema.index({ branch: 1, commitHash: 1 });
scanSchema.index({ status: 1 });

module.exports = mongoose.model('Scan', scanSchema);
