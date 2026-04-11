const request = require('supertest');
const app = require('../src/server');

describe('Auth Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return 200 and status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should fail with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Invalid email or password');
    });

    it('should fail if email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'somepassword'
        });
      expect(res.statusCode).toEqual(400);
    });
  });
});
