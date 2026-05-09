const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/middleware/authenticate');

// --- Mock DB ---
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

// --- Helpers ---
const adminToken = jwt.sign({ id: 10, role: 'ADMIN' }, jwtSecret);
const patientToken = jwt.sign({ id: 1, role: 'PATIENT' }, jwtSecret);
const doctorToken = jwt.sign({ id: 2, role: 'DOCTOR' }, jwtSecret);

const mockUserRows = [
    { id: 10, email: 'admin@hospital.com', role: 'ADMIN', created_at: '2026-01-01',
      p_first: null, p_last: null, phone: null, blood_group: null,
      d_first: null, d_last: null, specialty: null, location_room: null },
    { id: 1, email: 'patient@example.com', role: 'PATIENT', created_at: '2026-01-02',
      p_first: 'John', p_last: 'Doe', phone: '+15551234567', blood_group: 'O+',
      d_first: null, d_last: null, specialty: null, location_room: null },
    { id: 2, email: 'dr.sarah@hospital.com', role: 'DOCTOR', created_at: '2026-01-03',
      p_first: null, p_last: null, phone: null, blood_group: null,
      d_first: 'Sarah', d_last: 'Jenkins', specialty: 'Cardiologist', location_room: 'Block C' },
];

describe('Admin Users Endpoint — GET /api/admin/users', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ----------------------------------------------------------------
    //  AUTH & RBAC
    // ----------------------------------------------------------------
    describe('Authentication & Authorization', () => {
        it('should reject unauthenticated requests with 401', async () => {
            const res = await request(app).get('/api/admin/users');
            expect(res.statusCode).toBe(401);
        });

        it('should reject PATIENT role with 403', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${patientToken}`);
            expect(res.statusCode).toBe(403);
        });

        it('should reject DOCTOR role with 403', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${doctorToken}`);
            expect(res.statusCode).toBe(403);
        });
    });

    // ----------------------------------------------------------------
    //  RESPONSE SHAPE
    // ----------------------------------------------------------------
    describe('Response Shape', () => {
        it('should return { data, meta } envelope', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 3 }]])        // count query
                .mockResolvedValueOnce([mockUserRows]);           // data query

            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should include correct meta fields', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 3 }]])
                .mockResolvedValueOnce([mockUserRows]);

            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            const { meta } = res.body;
            expect(meta).toHaveProperty('total', 3);
            expect(meta).toHaveProperty('page', 1);
            expect(meta).toHaveProperty('limit', 10);
            expect(meta).toHaveProperty('total_pages', 1);
        });

        it('should map PATIENT profile fields correctly', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 1 }]])
                .mockResolvedValueOnce([[mockUserRows[1]]]);

            const res = await request(app)
                .get('/api/admin/users?role=PATIENT')
                .set('Authorization', `Bearer ${adminToken}`);

            const patient = res.body.data[0];
            expect(patient.name).toBe('John Doe');
            expect(patient.first_name).toBe('John');
            expect(patient.last_name).toBe('Doe');
            expect(patient.phone).toBe('+15551234567');
            expect(patient.blood_group).toBe('O+');
        });

        it('should map DOCTOR profile fields correctly', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 1 }]])
                .mockResolvedValueOnce([[mockUserRows[2]]]);

            const res = await request(app)
                .get('/api/admin/users?role=DOCTOR')
                .set('Authorization', `Bearer ${adminToken}`);

            const doctor = res.body.data[0];
            expect(doctor.name).toBe('Sarah Jenkins');
            expect(doctor.first_name).toBe('Sarah');
            expect(doctor.specialty).toBe('Cardiologist');
            expect(doctor.location_room).toBe('Block C');
        });

        it('should default ADMIN name to "Admin"', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 1 }]])
                .mockResolvedValueOnce([[mockUserRows[0]]]);

            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            const admin = res.body.data[0];
            expect(admin.name).toBe('Admin');
        });
    });

    // ----------------------------------------------------------------
    //  PAGINATION
    // ----------------------------------------------------------------
    describe('Pagination', () => {
        it('should respect page and limit query params', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 50 }]])
                .mockResolvedValueOnce([[mockUserRows[1]]]);

            const res = await request(app)
                .get('/api/admin/users?page=2&limit=5')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.body.meta.page).toBe(2);
            expect(res.body.meta.limit).toBe(5);
            expect(res.body.meta.total_pages).toBe(10);

            // Verify LIMIT and OFFSET were passed to the data query
            const dataQueryCall = db.query.mock.calls[1];
            const params = dataQueryCall[1];
            expect(params).toContain(5);  // limit
            expect(params).toContain(5);  // offset = (2-1)*5
        });

        it('should reject limit > 100 with 400', async () => {
            const res = await request(app)
                .get('/api/admin/users?limit=999')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });

        it('should reject negative page with 400', async () => {
            const res = await request(app)
                .get('/api/admin/users?page=-5')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });

        it('should default to page=1, limit=10 when no params given', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 3 }]])
                .mockResolvedValueOnce([mockUserRows]);

            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.body.meta.page).toBe(1);
            expect(res.body.meta.limit).toBe(10);
        });
    });

    // ----------------------------------------------------------------
    //  FILTERING
    // ----------------------------------------------------------------
    describe('Role Filtering', () => {
        it('should filter by role=DOCTOR', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 1 }]])
                .mockResolvedValueOnce([[mockUserRows[2]]]);

            const res = await request(app)
                .get('/api/admin/users?role=DOCTOR')
                .set('Authorization', `Bearer ${adminToken}`);

            // Verify WHERE clause includes role param
            const countCall = db.query.mock.calls[0];
            expect(countCall[0]).toContain('WHERE u.role = ?');
            expect(countCall[1]).toEqual(['DOCTOR']);

            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].role).toBe('DOCTOR');
        });

        it('should return all roles when role=ALL', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 3 }]])
                .mockResolvedValueOnce([mockUserRows]);

            const res = await request(app)
                .get('/api/admin/users?role=ALL')
                .set('Authorization', `Bearer ${adminToken}`);

            // Verify NO WHERE clause
            const countCall = db.query.mock.calls[0];
            expect(countCall[0]).not.toContain('WHERE');
            expect(res.body.data).toHaveLength(3);
        });
    });

    // ----------------------------------------------------------------
    //  SORTING
    // ----------------------------------------------------------------
    describe('Sorting', () => {
        it('should pass ORDER BY u.id ASC by default', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 3 }]])
                .mockResolvedValueOnce([mockUserRows]);

            await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            const dataCall = db.query.mock.calls[1];
            expect(dataCall[0]).toContain('ORDER BY u.id ASC');
        });

        it('should sort by name DESC when requested', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 3 }]])
                .mockResolvedValueOnce([mockUserRows]);

            await request(app)
                .get('/api/admin/users?sort_by=name&order=DESC')
                .set('Authorization', `Bearer ${adminToken}`);

            const dataCall = db.query.mock.calls[1];
            expect(dataCall[0]).toContain('COALESCE');
            expect(dataCall[0]).toContain('DESC');
        });

        it('should reject unknown sort_by values with 400', async () => {
            const res = await request(app)
                .get('/api/admin/users?sort_by=DROP_TABLE')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
    });

    // ----------------------------------------------------------------
    //  QUERY STRUCTURE (JOIN verification)
    // ----------------------------------------------------------------
    describe('SQL Query Structure', () => {
        it('should use LEFT JOINs on patients and doctors (no N+1)', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 3 }]])
                .mockResolvedValueOnce([mockUserRows]);

            await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            // Exactly 2 queries: 1 count + 1 data
            expect(db.query).toHaveBeenCalledTimes(2);

            const dataCall = db.query.mock.calls[1];
            expect(dataCall[0]).toContain('LEFT JOIN patients p ON u.id = p.id');
            expect(dataCall[0]).toContain('LEFT JOIN doctors d ON u.id = d.id');
        });

        it('should not mutate filter params between count and data queries', async () => {
            db.query
                .mockResolvedValueOnce([[{ total: 1 }]])
                .mockResolvedValueOnce([[mockUserRows[1]]]);

            await request(app)
                .get('/api/admin/users?role=PATIENT')
                .set('Authorization', `Bearer ${adminToken}`);

            const countParams = db.query.mock.calls[0][1];
            const dataParams = db.query.mock.calls[1][1];

            // Count should have only the role filter
            expect(countParams).toEqual(['PATIENT']);
            // Data should have role + limit + offset (separate array)
            expect(dataParams).toEqual(['PATIENT', 10, 0]);
        });
    });

    // ----------------------------------------------------------------
    //  ERROR HANDLING
    // ----------------------------------------------------------------
    describe('Error Handling', () => {
        it('should return 500 on database error', async () => {
            db.query.mockRejectedValueOnce(new Error('Connection refused'));

            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('message', 'Server error');
        });
    });
});
