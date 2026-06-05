const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/middleware/authenticate');

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: jest.fn()
      };
    })
  };
});

// Mock the database
const mockConn = {
  query: jest.fn(),
  beginTransaction: jest.fn().mockResolvedValue(),
  commit: jest.fn().mockResolvedValue(),
  rollback: jest.fn().mockResolvedValue(),
  release: jest.fn()
};

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(() => Promise.resolve({
    query: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn()
  }))
}));

describe('Auth Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  });

  describe('GET /api/health', () => {
    it('should return 200 and status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new patient successfully', async () => {
      const conn = {
        query: jest.fn()
          .mockResolvedValueOnce([[]]) // Check existing
          .mockResolvedValueOnce([{ insertId: 101 }]) // Insert user
          .mockResolvedValueOnce([{ affectedRows: 1 }]), // Insert patient
        beginTransaction: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn()
      };
      db.getConnection.mockResolvedValueOnce(conn);
      
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          first_name: 'John',
          last_name: 'Doe',
          phone: '1234567890'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('email', 'test@example.com');
      expect(conn.commit).toHaveBeenCalled();
    });

    it('should fail if email already exists', async () => {
      const conn = {
        query: jest.fn().mockResolvedValueOnce([[{ id: 1 }]]),
        beginTransaction: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn()
      };
      db.getConnection.mockResolvedValueOnce(conn);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'Password123',
          first_name: 'John',
          last_name: 'Doe',
          phone: '1234567890'
        });

      expect(res.statusCode).toEqual(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should fail with invalid credentials', async () => {
      db.query.mockResolvedValue([[]]); 

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('POST /api/auth/google', () => {
    it('should fail with 400 if token is missing', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({});
      expect(res.statusCode).toEqual(400);
    });

    it('should fail with 401 for invalid payload', async () => {
      const { OAuth2Client } = require('google-auth-library');
      const verifyIdTokenMock = jest.fn().mockResolvedValueOnce({
        getPayload: () => ({ email: 'test@example.com' }) // missing sub and email_verified
      });
      OAuth2Client.mockImplementation(() => ({
        verifyIdToken: verifyIdTokenMock
      }));

      const res = await request(app)
        .post('/api/auth/google')
        .send({ token: 'invalid_mock_token' });
      expect(res.statusCode).toEqual(401);
    });
  });
});
