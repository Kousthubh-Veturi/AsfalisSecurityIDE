const express = require('express');
const crypto = require('crypto');
const Repository = require('../models/Repository');
const scanService = require('../services/scanService');

const router = express.Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-secret';

/**
 * @route   POST /api/webhooks/github
 * @desc    Handle GitHub webhook events
 * @access  Public (but verified)
 */
router.post('/github', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.get('X-Hub-Signature-256');
    if (!signature || !verifySignature(req.body, signature)) {
      console.log('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.get('X-GitHub-Event');
    const payload = JSON.parse(req.body.toString());

    console.log(`Received GitHub webhook: ${event} for ${payload.repository?.full_name}`);

    // Handle push events
    if (event === 'push') {
      await handlePushEvent(payload);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle GitHub push events
 */
async function handlePushEvent(payload) {
  try {
    const { repository: githubRepo, ref, head_commit } = payload;
    
    if (!head_commit) {
      console.log('No head commit in push event, skipping...');
      return;
    }

    // Extract branch name from ref (refs/heads/branch-name)
    const branchName = ref.replace('refs/heads/', '');
    
    console.log(`Push event: ${githubRepo.full_name}:${branchName} (${head_commit.id})`);

    // Find repository in our database
    const repository = await Repository.findOne({
      githubId: githubRepo.id,
      isActive: true
    }).populate('owner');

    if (!repository) {
      console.log(`Repository ${githubRepo.full_name} not being monitored`);
      return;
    }

    // Check if this branch is being monitored
    const monitoredBranch = repository.monitoredBranches.find(
      branch => branch.name === branchName && branch.enabled
    );

    if (!monitoredBranch) {
      console.log(`Branch ${branchName} not being monitored for ${githubRepo.full_name}`);
      return;
    }

    // Check if we've already scanned this commit
    if (monitoredBranch.lastScannedCommit === head_commit.id) {
      console.log(`Commit ${head_commit.id} already scanned, skipping...`);
      return;
    }

    // Trigger security scan
    console.log(`Triggering security scan for ${githubRepo.full_name}:${branchName}@${head_commit.id}`);
    
    await scanService.triggerScan({
      repository: repository,
      branch: branchName,
      commitHash: head_commit.id,
      triggerType: 'webhook'
    });

    // Update last scanned commit
    monitoredBranch.lastScannedCommit = head_commit.id;
    repository.lastActivity = new Date();
    await repository.save();

  } catch (error) {
    console.error('Error handling push event:', error);
  }
}

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload, signature) {
  try {
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex')}`;
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * @route   GET /api/webhooks/test
 * @desc    Test webhook endpoint
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
