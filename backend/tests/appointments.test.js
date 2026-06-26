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
      // Mock duration prediction and transaction queries
      const queryMock = jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT max_patients_per_slot') && sql.includes('FROM doctors')) {
          return Promise.resolve([[{ max_patients_per_slot: 10, first_name: 'John', last_name: 'Doe' }]]);
        }
        if (sql.includes('SELECT COUNT(*) AS slot_count')) {
          return Promise.resolve([[{ slot_count: 0 }]]);
        }
        if (sql.includes('INSERT INTO appointments')) {
          return Promise.resolve([{ insertId: 101 }]);
        }
        if (sql.includes('SELECT 1 FROM appointments')) {
          return Promise.resolve([[1]]); // Today check
        }
        if (sql.includes('SELECT MAX(lq.queue_number)')) {
          return Promise.resolve([[{ maxQ: 5 }]]);
        }
        if (sql.includes('INSERT INTO live_queue')) {
          return Promise.resolve([{ insertId: 1 }]);
        }
        if (sql.includes('SELECT lq.queue_number')) {
          return Promise.resolve([[{ queue_number: 6, doctor_id: 1, appointment_date: '2026-06-01' }]]);
        }
        return Promise.resolve([[]]);
      });

      db.query.mockImplementation(queryMock);

      const mockConn = {
        query: queryMock,
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      };
      db.getConnection.mockResolvedValue(mockConn);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDateString = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${token}`)
        .send({
          doctorId: 1,
          date: futureDateString,
          timeSlot: '10:00 AM',
          symptoms: 'Fever'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('appointmentId', 101);
      expect(res.body).toHaveProperty('queueNumber', 6);
    });

    it('should return 404 if the doctor is not found', async () => {
      const queryMock = jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT max_patients_per_slot') && sql.includes('FROM doctors')) {
          return Promise.resolve([[]]); // Doctor not found
        }
        return Promise.resolve([[]]);
      });

      db.query.mockImplementation(queryMock);

      const mockConn = {
        query: queryMock,
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      };
      db.getConnection.mockResolvedValue(mockConn);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDateString = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/appointments/book')
        .set('Authorization', `Bearer ${token}`)
        .send({
          doctorId: 999,
          date: futureDateString,
          timeSlot: '10:00 AM',
          symptoms: 'Fever'
        });

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('message', 'Doctor not found');
      expect(mockConn.rollback).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/appointments/:id/cancel', () => {
    it('should cancel an appointment and release slot', async () => {
      // Use a future date so BUG-003 past-date guard does not block the request
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mockConn = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ status: 'CONFIRMED', appointment_date: tomorrow, patient_id: 1 }]]) // First query: select appt
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

    it('BUG-003: should return 400 when a PATIENT tries to cancel a past appointment', async () => {
      // Appointment date in the past
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const mockConn = {
        query: jest.fn()
          .mockResolvedValueOnce([[{ status: 'CONFIRMED', appointment_date: yesterday, patient_id: 1 }]]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn()
      };
      db.getConnection.mockResolvedValue(mockConn);

      const res = await request(app)
        .patch('/api/appointments/99/cancel')
        .set('Authorization', `Bearer ${token}`); // token has role PATIENT

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Cannot cancel a past appointment');
      // Verify the transaction was never started (request rejected before beginTransaction)
      expect(mockConn.beginTransaction).not.toHaveBeenCalled();
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
