const request = require('supertest');
const app = require('../index');
const User = require('../models/User');

describe('Authentication Routes', () => {
  describe('POST /api/auth/callback', () => {
    it('should handle GitHub OAuth callback', async () => {
      const mockGitHubData = {
        code: 'test-code',
        state: 'test-state'
      };

      const response = await request(app)
        .post('/api/auth/callback')
        .send(mockGitHubData);

      // Note: This would require mocking GitHub API calls
      // For now, we expect it to fail with missing credentials
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should handle logout request', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401); // Without auth token
    });
  });
});
