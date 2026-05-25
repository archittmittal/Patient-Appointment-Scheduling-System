const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/middleware/authenticate');

// Mock the database
jest.mock('../src/config/db', () => ({
  query: jest.fn().mockResolvedValue([[]]),
  getConnection: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn()
}));

// Helper to create a test token
const createToken = (id, role = 'PATIENT') => {
  return jwt.sign({ id, role, email: 'test@example.com' }, jwtSecret);
};

describe('Appointment & Queue Endpoints', () => {
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    token = createToken(1);
    
    // Mock getConnection for transactions
    db.getConnection.mockResolvedValue({
      query: jest.fn().mockResolvedValue([[]]),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    });
  });

  describe('POST /api/appointments/book', () => {
    it('should book an appointment successfully', async () => {
      // Mock duration prediction response (since it's called internally)
      // Note: predictConsultationDuration is imported in the route, 
      // but we need to mock the DB queries it makes if we don't mock the service itself.
      // For simplicity, let's mock the DB queries made during booking.
      
      db.query.mockImplementation((sql) => {
        if (sql.includes('INSERT INTO appointments')) {
          return Promise.resolve([{ insertId: 101 }]);
        }
        if (sql.includes('SELECT 1 FROM appointments')) {
          return Promise.resolve([[1]]); // Today check
        }
        if (sql.includes('SELECT MAX(lq.queue_number)')) {
          return Promise.resolve([[{ maxQ: 5 }]]);
        }
        return Promise.resolve([[]]);
      });

      const res = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${token}`)
        .send({
          doctorId: 1,
          date: '2026-04-22',
          timeSlot: '10:00 AM',
          symptoms: 'Fever'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('appointmentId', 101);
      expect(res.body).toHaveProperty('queueNumber', 6);
    });
  });

  describe('PATCH /api/appointments/:id/cancel', () => {
    it('should cancel an appointment and release slot', async () => {
      const mockConn = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ status: 'CONFIRMED', appointment_date: new Date(), patient_id: 1 }]]) // First query: select appt
          .mockResolvedValueOnce([{ affectedRows: 1 }]) // Second: update status
          .mockResolvedValueOnce([{ affectedRows: 1 }]), // Third: update live_queue
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      };
      db.getConnection.mockResolvedValue(mockConn);

      const res = await request(app)
        .patch('/api/appointments/101/cancel')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Appointment cancelled');
      expect(mockConn.beginTransaction).toHaveBeenCalled();
      expect(mockConn.commit).toHaveBeenCalled();
    });
  });

  describe('Walk-in Priority Logic (ISSUE-103)', () => {
    it('should register a walk-in and assign a priority position', async () => {
      // Mocking the registerWalkin internal DB calls
      db.query.mockImplementation((sql) => {
        if (sql.includes('SELECT priority_weight FROM urgency_config')) {
          return Promise.resolve([[{ priority_weight: 5 }]]); // EMERGENCY
        }
        if (sql.includes('INSERT INTO walkin_queue')) {
          return Promise.resolve([{ insertId: 201 }]);
        }
        if (sql.includes('SELECT id, triage_score, queue_position FROM walkin_queue')) {
          return Promise.resolve([[ { id: 200, triage_score: 100, queue_position: 1 } ]]);
        }
        return Promise.resolve([[]]);
      });

      const res = await request(app)
        .post('/api/walkin/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          doctorId: 1,
          urgencyLevel: 'EMERGENCY',
          reason: 'Shortness of breath',
          vitalSigns: { oxygen_saturation: 92 }
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.triageScore).toBeGreaterThan(100);
    });
  });
});
