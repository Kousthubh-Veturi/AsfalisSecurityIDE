#!/usr/bin/env node

const mongoose = require('mongoose');
const User = require('../models/User');
const Repository = require('../models/Repository');
const Scan = require('../models/Scan');

// Load environment variables
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/asfalis-security';

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Repository.deleteMany({});
    await Scan.deleteMany({});
    console.log('Cleared existing data');

    // Create sample user
    const sampleUser = new User({
      githubId: '123456',
      username: 'sampleuser',
      email: 'sample@example.com',
      avatarUrl: 'https://github.com/identicons/sampleuser.png',
      accessToken: 'sample_token_for_development',
      settings: {
        emailNotifications: true,
        scanOnPush: true
      }
    });

    await sampleUser.save();
    console.log('Created sample user');

    // Create sample repository
    const sampleRepo = new Repository({
      owner: sampleUser._id,
      githubId: 987654,
      name: 'sample-repo',
      fullName: 'sampleuser/sample-repo',
      description: 'Sample repository for development',
      private: false,
      defaultBranch: 'main',
      monitoredBranches: [
        {
          name: 'main',
          enabled: true,
          lastScannedCommit: 'abc123'
        }
      ],
      scanSettings: {
        enabledRules: ['security', 'best-practices'],
        severityThreshold: 'medium',
        excludePatterns: ['node_modules/**', '*.test.js']
      },
      isActive: true
    });

    await sampleRepo.save();
    console.log('Created sample repository');

    // Create sample scan
    const sampleScan = new Scan({
      repository: sampleRepo._id,
      branch: 'main',
      commitHash: 'abc123',
      triggerType: 'manual',
      status: 'completed',
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
      duration: 45000,
      results: [
        {
          ruleId: 'security/no-eval',
          severity: 'high',
          message: 'Use of eval() detected',
          file: 'src/utils.js',
          line: 15,
          column: 8,
          codeSnippet: 'eval(userInput)',
          category: 'injection',
          suggestion: 'Use JSON.parse() instead of eval()'
        },
        {
          ruleId: 'security/no-innerHTML',
          severity: 'medium',
          message: 'Potential XSS vulnerability',
          file: 'src/components/Display.js',
          line: 28,
          column: 12,
          codeSnippet: 'element.innerHTML = data',
          category: 'xss',
          suggestion: 'Use textContent or sanitize input'
        }
      ],
      summary: {
        totalIssues: 2,
        criticalCount: 0,
        highCount: 1,
        mediumCount: 1,
        lowCount: 0,
        filesScanned: 12,
        linesOfCode: 1250
      },
      scannerVersion: '1.0.0'
    });

    await sampleScan.save();
    console.log('Created sample scan');

    console.log('Database seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
