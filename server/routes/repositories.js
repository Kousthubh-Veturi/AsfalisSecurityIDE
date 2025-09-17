const express = require('express');
const axios = require('axios');
const Repository = require('../models/Repository');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/repositories
 * @desc    Get user's GitHub repositories
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    // Get repositories from GitHub API
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      params: {
        sort: 'updated',
        per_page: 100,
        affiliation: 'owner,collaborator'
      }
    });

    const githubRepos = response.data;

    // Get user's saved repositories from database
    const savedRepos = await Repository.find({ owner: req.user.userId });
    const savedRepoMap = new Map(savedRepos.map(repo => [repo.githubId, repo]));

    // Combine GitHub data with saved data
    const repositories = githubRepos.map(githubRepo => {
      const savedRepo = savedRepoMap.get(githubRepo.id);
      
      return {
        githubId: githubRepo.id,
        name: githubRepo.name,
        fullName: githubRepo.full_name,
        description: githubRepo.description,
        private: githubRepo.private,
        defaultBranch: githubRepo.default_branch,
        htmlUrl: githubRepo.html_url,
        language: githubRepo.language,
        updatedAt: githubRepo.updated_at,
        isMonitored: !!savedRepo,
        monitoredBranches: savedRepo?.monitoredBranches || [],
        scanSettings: savedRepo?.scanSettings || {
          enabledRules: [],
          severityThreshold: 'medium',
          excludePatterns: []
        }
      };
    });

    res.json(repositories);
  } catch (error) {
    console.error('Get repositories error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch repositories',
      message: error.response?.data?.message || error.message
    });
  }
});

/**
 * @route   GET /api/repositories/:repoId/branches
 * @desc    Get repository branches
 * @access  Private
 */
router.get('/:repoId/branches', auth, async (req, res) => {
  try {
    const { repoId } = req.params;

    // Get repository info first
    const repoResponse = await axios.get(`https://api.github.com/repositories/${repoId}`, {
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const repo = repoResponse.data;

    // Get branches
    const branchesResponse = await axios.get(`https://api.github.com/repos/${repo.full_name}/branches`, {
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      params: {
        per_page: 100
      }
    });

    const branches = branchesResponse.data.map(branch => ({
      name: branch.name,
      commit: {
        sha: branch.commit.sha,
        url: branch.commit.url
      },
      protected: branch.protected || false
    }));

    res.json(branches);
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch branches',
      message: error.response?.data?.message || error.message
    });
  }
});

/**
 * @route   POST /api/repositories/:repoId/monitor
 * @desc    Start monitoring a repository
 * @access  Private
 */
router.post('/:repoId/monitor', auth, async (req, res) => {
  try {
    const { repoId } = req.params;
    const { branches, scanSettings } = req.body;

    if (!branches || !Array.isArray(branches) || branches.length === 0) {
      return res.status(400).json({ error: 'At least one branch must be specified' });
    }

    // Get repository info from GitHub
    const repoResponse = await axios.get(`https://api.github.com/repositories/${repoId}`, {
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const githubRepo = repoResponse.data;

    // Check if repository is already being monitored
    let repository = await Repository.findOne({
      owner: req.user.userId,
      githubId: parseInt(repoId)
    });

    if (repository) {
      // Update existing repository
      repository.monitoredBranches = branches.map(branch => ({
        name: branch,
        enabled: true,
        lastScannedCommit: null,
        webhookId: null
      }));
      repository.scanSettings = scanSettings || repository.scanSettings;
      repository.isActive = true;
      repository.lastActivity = new Date();
    } else {
      // Create new repository record
      repository = new Repository({
        owner: req.user.userId,
        githubId: parseInt(repoId),
        name: githubRepo.name,
        fullName: githubRepo.full_name,
        description: githubRepo.description,
        private: githubRepo.private,
        defaultBranch: githubRepo.default_branch,
        monitoredBranches: branches.map(branch => ({
          name: branch,
          enabled: true,
          lastScannedCommit: null,
          webhookId: null
        })),
        scanSettings: scanSettings || {
          enabledRules: ['security', 'best-practices'],
          severityThreshold: 'medium',
          excludePatterns: ['node_modules/**', '*.test.js', '*.spec.js']
        },
        isActive: true
      });
    }

    await repository.save();

    // Set up webhooks for monitored branches
    try {
      await setupWebhooks(req.user.accessToken, githubRepo.full_name, repository);
    } catch (webhookError) {
      console.error('Webhook setup error:', webhookError);
      // Continue even if webhook setup fails
    }

    res.json({
      success: true,
      repository: {
        id: repository._id,
        githubId: repository.githubId,
        name: repository.name,
        fullName: repository.fullName,
        monitoredBranches: repository.monitoredBranches,
        scanSettings: repository.scanSettings,
        isActive: repository.isActive
      }
    });
  } catch (error) {
    console.error('Monitor repository error:', error);
    res.status(500).json({ 
      error: 'Failed to start monitoring repository',
      message: error.response?.data?.message || error.message
    });
  }
});

/**
 * @route   DELETE /api/repositories/:repoId/monitor
 * @desc    Stop monitoring a repository
 * @access  Private
 */
router.delete('/:repoId/monitor', auth, async (req, res) => {
  try {
    const { repoId } = req.params;

    const repository = await Repository.findOne({
      owner: req.user.userId,
      githubId: parseInt(repoId)
    });

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Remove webhooks
    try {
      await removeWebhooks(req.user.accessToken, repository.fullName, repository);
    } catch (webhookError) {
      console.error('Webhook removal error:', webhookError);
    }

    // Deactivate repository
    repository.isActive = false;
    repository.monitoredBranches = [];
    await repository.save();

    res.json({
      success: true,
      message: 'Repository monitoring stopped'
    });
  } catch (error) {
    console.error('Stop monitoring error:', error);
    res.status(500).json({ 
      error: 'Failed to stop monitoring repository',
      message: error.message
    });
  }
});

// Helper function to setup webhooks
async function setupWebhooks(accessToken, repoFullName, repository) {
  const webhookUrl = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/webhooks/github`;
  
  try {
    const response = await axios.post(`https://api.github.com/repos/${repoFullName}/hooks`, {
      name: 'web',
      active: true,
      events: ['push'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret: process.env.WEBHOOK_SECRET || 'default-secret'
      }
    }, {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    // Update repository with webhook ID
    const webhookId = response.data.id;
    repository.monitoredBranches.forEach(branch => {
      branch.webhookId = webhookId;
    });
    await repository.save();

    console.log(`Webhook created for ${repoFullName}: ${webhookId}`);
  } catch (error) {
    console.error('Webhook setup failed:', error.response?.data || error.message);
    throw error;
  }
}

// Helper function to remove webhooks
async function removeWebhooks(accessToken, repoFullName, repository) {
  const webhookIds = repository.monitoredBranches
    .map(branch => branch.webhookId)
    .filter(id => id);

  for (const webhookId of webhookIds) {
    try {
      await axios.delete(`https://api.github.com/repos/${repoFullName}/hooks/${webhookId}`, {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      console.log(`Webhook removed for ${repoFullName}: ${webhookId}`);
    } catch (error) {
      console.error(`Failed to remove webhook ${webhookId}:`, error.response?.data || error.message);
    }
  }
}

module.exports = router;
