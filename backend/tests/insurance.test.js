const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/middleware/authenticate');
const insuranceService = require('../src/services/insuranceService');

// Mock the database
jest.mock('../src/config/db', () => ({
  query: jest.fn().mockResolvedValue([[]])
}));

const createToken = (id, role = 'PATIENT') => {
  return jwt.sign({ id, role, email: 'test@example.com' }, jwtSecret);
};

describe('Insurance & Claims System Tests', () => {
  let patientToken;
  let adminToken;
  let doctorToken;

  beforeEach(() => {
    jest.clearAllMocks();
    patientToken = createToken(1, 'PATIENT');
    adminToken = createToken(2, 'ADMIN');
    doctorToken = createToken(3, 'DOCTOR');
  });

  describe('GET /api/insurance/providers', () => {
    it('should allow patient to retrieve active insurance providers and write audit log', async () => {
      const mockProviders = [{ id: 1, name: 'BCBS', contact_email: 'support@bcbs.com' }];
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('SELECT id, name, contact_email FROM insurance_providers')) {
          return Promise.resolve([mockProviders]);
        }
        if (sql.includes('INSERT INTO audit_logs')) {
          return Promise.resolve([{ insertId: 10 }]);
        }
        return Promise.resolve([[]]);
      });

      const res = await request(app)
        .get('/api/insurance/providers')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockProviders);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.any(Array)
      );
    });
  });

  describe('GET /api/insurance/my', () => {
    it('should retrieve logged in patient\'s insurance policy', async () => {
      const mockPolicy = [{ id: 5, patient_id: 1, member_id: 'MEM123' }];
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('SELECT pi.*, ip.name as provider_name')) {
          return Promise.resolve([mockPolicy]);
        }
        return Promise.resolve([[]]);
      });

      const res = await request(app)
        .get('/api/insurance/my')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPolicy);
    });

    it('should reject non-patient roles from /my', async () => {
      const res = await request(app)
        .get('/api/insurance/my')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/insurance/save', () => {
    it('should save patient insurance policy for patient self', async () => {
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('SELECT id FROM patient_insurance')) {
          return Promise.resolve([[]]); // Not existing
        }
        if (sql.includes('INSERT INTO patient_insurance')) {
          return Promise.resolve([{ insertId: 10 }]);
        }
        return Promise.resolve([[]]);
      });

      const res = await request(app)
        .post('/api/insurance/save')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ providerId: 1, memberId: 'MEM123', groupId: 'GRP99', planType: 'PPO', policyHolderName: 'John Doe' });

      expect(res.status).toBe(201);
      expect(res.body.action).toBe('CREATED');
    });

    it('should allow admin to save insurance for any patient specifying patientId', async () => {
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('SELECT id FROM patient_insurance')) {
          return Promise.resolve([[]]);
        }
        if (sql.includes('INSERT INTO patient_insurance')) {
          return Promise.resolve([{ insertId: 10 }]);
        }
        return Promise.resolve([[]]);
      });

      const res = await request(app)
        .post('/api/insurance/save')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ patientId: 4, providerId: 1, memberId: 'MEM123', groupId: 'GRP99', planType: 'PPO', policyHolderName: 'John Doe' });

      expect(res.status).toBe(201);
    });
  });

  describe('POST /api/insurance/verify/:id', () => {
    it('should verify eligibility successfully using mock pattern', async () => {
      const mockPolicy = [{
        id: 5, patient_id: 1, provider_id: 1, member_id: 'MEM123', name: 'BCBS', provider_name: 'BCBS'
      }];
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('SELECT patient_id FROM patient_insurance WHERE id = ?')) {
          return Promise.resolve([[{ patient_id: 1 }]]);
        }
        if (sql.includes('SELECT pi.*, ip.api_endpoint')) {
          return Promise.resolve([mockPolicy]);
        }
        if (sql.includes('UPDATE patient_insurance SET status = ?')) {
          return Promise.resolve([[]]);
        }
        return Promise.resolve([[]]);
      });

      const res = await request(app)
        .post('/api/insurance/verify/5')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('VERIFIED');
      expect(res.body.verified).toBe(true);
    });

    it('should forbid user from verifying someone else\'s insurance policy', async () => {
      db.query.mockImplementation((sql, params) => {
        if (sql.includes('SELECT patient_id FROM patient_insurance WHERE id = ?')) {
          return Promise.resolve([[{ patient_id: 99 }]]); // Other patient
        }
        return Promise.resolve([[]]);
      });

      const res = await request(app)
        .post('/api/insurance/verify/5')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Claims Tracking API Endpoints', () => {
    describe('POST /api/insurance/claims', () => {
      it('should create an insurance claim successfully', async () => {
        db.query.mockImplementation((sql, params) => {
          if (sql.includes('SELECT patient_id FROM patient_insurance WHERE id = ?')) {
            return Promise.resolve([[{ patient_id: 1 }]]);
          }
          if (sql.includes('INSERT INTO insurance_claims')) {
            return Promise.resolve([{ insertId: 50 }]);
          }
          return Promise.resolve([[]]);
        });

        const res = await request(app)
          .post('/api/insurance/claims')
          .set('Authorization', `Bearer ${patientToken}`)
          .send({ patientInsuranceId: 5, amountBilled: 250.00 });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(50);
        expect(res.body.status).toBe('SUBMITTED');
      });
    });

    describe('GET /api/insurance/claims/my', () => {
      it('should return claims for logged in patient', async () => {
        const mockClaims = [{ id: 50, amount_billed: 250.00, status: 'SUBMITTED' }];
        db.query.mockImplementation((sql, params) => {
          if (sql.includes('SELECT ic.*, pi.member_id, pi.group_id')) {
            return Promise.resolve([mockClaims]);
          }
          return Promise.resolve([[]]);
        });

        const res = await request(app)
          .get('/api/insurance/claims/my')
          .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockClaims);
      });
    });

    describe('GET /api/insurance/claims/patient/:patientId', () => {
      it('should allow patient to retrieve their own claims', async () => {
        const mockClaims = [{ id: 50, amount_billed: 250.00 }];
        db.query.mockImplementation((sql, params) => {
          if (sql.includes('SELECT ic.*, pi.member_id, pi.group_id')) {
            return Promise.resolve([mockClaims]);
          }
          return Promise.resolve([[]]);
        });

        const res = await request(app)
          .get('/api/insurance/claims/patient/1')
          .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(200);
      });

      it('should forbid patients from viewing other patient claims', async () => {
        const res = await request(app)
          .get('/api/insurance/claims/patient/44')
          .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(403);
      });
    });

    describe('PATCH /api/insurance/claims/:id', () => {
      it('should allow admin to approve or reject a claim', async () => {
        const mockClaim = { id: 50, amount_billed: 250.00, amount_covered: 200.00, status: 'APPROVED', patient_id: 1 };
        db.query.mockImplementation((sql, params) => {
          if (sql.includes('UPDATE insurance_claims SET')) {
            return Promise.resolve([[]]);
          }
          if (sql.includes('SELECT ic.*, pi.patient_id')) {
            return Promise.resolve([[mockClaim]]);
          }
          return Promise.resolve([[]]);
        });

        const res = await request(app)
          .patch('/api/insurance/claims/50')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ amountCovered: 200.00, status: 'APPROVED' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('APPROVED');
        expect(res.body.amount_covered).toBe(200.00);
      });
    });

    describe('DELETE /api/insurance/claims/:id', () => {
      it('should allow admin to delete a claim', async () => {
        db.query.mockResolvedValue([[]]);

        const res = await request(app)
          .delete('/api/insurance/claims/50')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM insurance_claims'),
          [50]
        );
      });
    });
  });
});
