const express = require('express');
const Scan = require('../models/Scan');
const Repository = require('../models/Repository');
const scanService = require('../services/scanService');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/scans
 * @desc    Get user's scans
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, repository, status, branch } = req.query;

    // Get user's repositories
    const userRepos = await Repository.find({ 
      owner: req.user.userId 
    }).select('_id');
    
    const repoIds = userRepos.map(repo => repo._id);

    // Build query
    let query = { repository: { $in: repoIds } };
    
    if (repository) {
      query.repository = repository;
    }
    if (status) {
      query.status = status;
    }
    if (branch) {
      query.branch = branch;
    }

    // Execute query with pagination
    const scans = await Scan.find(query)
      .populate('repository', 'name fullName githubId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Scan.countDocuments(query);

    res.json({
      scans,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalScans: total,
      hasNext: page * limit < total,
      hasPrev: page > 1
    });
  } catch (error) {
    console.error('Get scans error:', error);
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

/**
 * @route   GET /api/scans/:scanId
 * @desc    Get scan details
 * @access  Private
 */
router.get('/:scanId', auth, async (req, res) => {
  try {
    const scan = await Scan.findById(req.params.scanId)
      .populate('repository', 'name fullName githubId owner');

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Check if user owns the repository
    if (scan.repository.owner.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(scan);
  } catch (error) {
    console.error('Get scan error:', error);
    res.status(500).json({ error: 'Failed to fetch scan details' });
  }
});

/**
 * @route   POST /api/scans/trigger
 * @desc    Manually trigger a security scan
 * @access  Private
 */
router.post('/trigger', auth, async (req, res) => {
  try {
    const { repositoryId, branch, commitHash } = req.body;

    if (!repositoryId || !branch) {
      return res.status(400).json({ error: 'Repository ID and branch are required' });
    }

    // Verify repository ownership
    const repository = await Repository.findOne({
      _id: repositoryId,
      owner: req.user.userId,
      isActive: true
    });

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found or not active' });
    }

    // Check if branch is monitored
    const monitoredBranch = repository.monitoredBranches.find(
      b => b.name === branch && b.enabled
    );

    if (!monitoredBranch) {
      return res.status(400).json({ error: 'Branch is not being monitored' });
    }

    // Trigger scan
    const scan = await scanService.triggerScan({
      repository: repository,
      branch: branch,
      commitHash: commitHash || 'HEAD',
      triggerType: 'manual'
    });

    res.json({
      success: true,
      scanId: scan._id,
      message: 'Security scan initiated'
    });
  } catch (error) {
    console.error('Trigger scan error:', error);
    res.status(500).json({ 
      error: 'Failed to trigger scan',
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/scans/:scanId/results
 * @desc    Get scan results with filtering
 * @access  Private
 */
router.get('/:scanId/results', auth, async (req, res) => {
  try {
    const { severity, category, file } = req.query;
    
    const scan = await Scan.findById(req.params.scanId)
      .populate('repository', 'name fullName owner');

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Check ownership
    if (scan.repository.owner.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let results = scan.results;

    // Apply filters
    if (severity) {
      results = results.filter(result => result.severity === severity);
    }
    if (category) {
      results = results.filter(result => result.category === category);
    }
    if (file) {
      results = results.filter(result => result.file.includes(file));
    }

    // Group by severity for summary
    const summary = {
      total: results.length,
      critical: results.filter(r => r.severity === 'critical').length,
      high: results.filter(r => r.severity === 'high').length,
      medium: results.filter(r => r.severity === 'medium').length,
      low: results.filter(r => r.severity === 'low').length
    };

    res.json({
      scanId: scan._id,
      status: scan.status,
      summary: summary,
      results: results,
      filters: { severity, category, file }
    });
  } catch (error) {
    console.error('Get scan results error:', error);
    res.status(500).json({ error: 'Failed to fetch scan results' });
  }
});

/**
 * @route   GET /api/scans/stats/dashboard
 * @desc    Get dashboard statistics
 * @access  Private
 */
router.get('/stats/dashboard', auth, async (req, res) => {
  try {
    // Get user's repositories
    const userRepos = await Repository.find({ 
      owner: req.user.userId 
    }).select('_id');
    
    const repoIds = userRepos.map(repo => repo._id);

    // Get recent scans
    const recentScans = await Scan.find({ 
      repository: { $in: repoIds } 
    })
    .populate('repository', 'name fullName')
    .sort({ createdAt: -1 })
    .limit(10);

    // Get scan statistics
    const totalScans = await Scan.countDocuments({ repository: { $in: repoIds } });
    const completedScans = await Scan.countDocuments({ 
      repository: { $in: repoIds }, 
      status: 'completed' 
    });
    const failedScans = await Scan.countDocuments({ 
      repository: { $in: repoIds }, 
      status: 'failed' 
    });

    // Get vulnerability statistics from recent completed scans
    const recentCompletedScans = await Scan.find({ 
      repository: { $in: repoIds },
      status: 'completed',
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    let totalVulns = 0;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    recentCompletedScans.forEach(scan => {
      totalVulns += scan.summary.totalIssues;
      criticalCount += scan.summary.criticalCount;
      highCount += scan.summary.highCount;
      mediumCount += scan.summary.mediumCount;
      lowCount += scan.summary.lowCount;
    });

    res.json({
      scanStats: {
        total: totalScans,
        completed: completedScans,
        failed: failedScans,
        successRate: totalScans > 0 ? Math.round((completedScans / totalScans) * 100) : 0
      },
      vulnerabilityStats: {
        total: totalVulns,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount
      },
      recentScans: recentScans.map(scan => ({
        id: scan._id,
        repository: scan.repository.name,
        branch: scan.branch,
        status: scan.status,
        totalIssues: scan.summary.totalIssues,
        createdAt: scan.createdAt,
        completedAt: scan.completedAt,
        duration: scan.duration
      }))
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

module.exports = router;
