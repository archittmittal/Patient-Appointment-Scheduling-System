const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

// Mock database module
jest.mock('../src/config/db', () => {
    const mockQuery = jest.fn();
    return {
        query: mockQuery,
        getConnection: jest.fn()
    };
});

describe('JWT Refresh Tokens & Session Revocation Tests (PR #12)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockClear();
    });

    describe('Access Token Lifespan', () => {
        it('should generate an access token with a 15-minute expiration (900 seconds) by default', async () => {
            // Mock login behavior
            const mockUser = {
                id: 101,
                email: 'patient@example.com',
                password_hash: '$2a$10$abcdefghijklmnopqrstuv', // valid mock hash
                role: 'PATIENT',
                auth_provider: 'LOCAL'
            };
            const mockPatientProfile = { first_name: 'John', last_name: 'Doe' };

            db.query.mockImplementation((sql, params) => {
                const upperSql = sql.trim().toUpperCase();
                if (upperSql.includes('SELECT * FROM USERS')) {
                    return Promise.resolve([[mockUser], []]);
                }
                if (upperSql.includes('SELECT FIRST_NAME, LAST_NAME FROM PATIENTS')) {
                    return Promise.resolve([[mockPatientProfile], []]);
                }
                if (upperSql.includes('INSERT INTO REFRESH_TOKENS')) {
                    return Promise.resolve([{ affectedRows: 1, insertId: 1 }, []]);
                }
                return Promise.resolve([[], []]);
            });

            // Mock bcrypt.compare to succeed
            const bcrypt = require('bcryptjs');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'patient@example.com', password: 'Password123' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('refreshToken');

            const decoded = jwt.decode(res.body.token);
            expect(decoded).toHaveProperty('exp');
            expect(decoded).toHaveProperty('iat');
            
            // Difference in seconds should be 15 mins (900s)
            const duration = decoded.exp - decoded.iat;
            expect(duration).toBe(900);
        });
    });

    describe('Token Rotation (POST /api/auth/refresh)', () => {
        it('should issue a new token pair and delete the old refresh token', async () => {
            const mockRefreshToken = 'old_refresh_token_string';
            const mockStoredToken = {
                id: 1,
                user_id: 101,
                token: mockRefreshToken,
                expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // 7 days in future
            };
            const mockUser = { id: 101, email: 'patient@example.com', role: 'PATIENT' };

            db.query.mockImplementation((sql, params) => {
                const upperSql = sql.trim().toUpperCase();
                if (upperSql.includes('SELECT * FROM REFRESH_TOKENS WHERE TOKEN = ?')) {
                    return Promise.resolve([[mockStoredToken], []]);
                }
                if (upperSql.includes('SELECT * FROM USERS WHERE ID = ?')) {
                    return Promise.resolve([[mockUser], []]);
                }
                if (upperSql.includes('DELETE FROM REFRESH_TOKENS WHERE TOKEN = ?')) {
                    return Promise.resolve([{ affectedRows: 1 }, []]);
                }
                if (upperSql.includes('INSERT INTO REFRESH_TOKENS')) {
                    return Promise.resolve([{ affectedRows: 1, insertId: 2 }, []]);
                }
                return Promise.resolve([[], []]);
            });

            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: mockRefreshToken });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('refreshToken');

            // Verify old token was deleted
            const deleteCall = db.query.mock.calls.find(c => c[0] && c[0].toUpperCase().includes('DELETE FROM REFRESH_TOKENS'));
            expect(deleteCall).toBeDefined();
            expect(deleteCall[1]).toEqual([mockRefreshToken]);
        });

        it('should fail with 401 if refresh token is expired', async () => {
            const mockRefreshToken = 'expired_refresh_token_string';
            const mockStoredToken = {
                id: 1,
                user_id: 101,
                token: mockRefreshToken,
                expires_at: new Date(Date.now() - 1000).toISOString() // expired 1s ago
            };

            db.query.mockImplementation((sql, params) => {
                const upperSql = sql.trim().toUpperCase();
                if (upperSql.includes('SELECT * FROM REFRESH_TOKENS WHERE TOKEN = ?')) {
                    return Promise.resolve([[mockStoredToken], []]);
                }
                if (upperSql.includes('DELETE FROM REFRESH_TOKENS WHERE TOKEN = ?')) {
                    return Promise.resolve([{ affectedRows: 1 }, []]);
                }
                return Promise.resolve([[], []]);
            });

            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: mockRefreshToken });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toMatch(/expired/i);

            // Verify old token was deleted from database
            const deleteCall = db.query.mock.calls.find(c => c[0] && c[0].toUpperCase().includes('DELETE FROM REFRESH_TOKENS'));
            expect(deleteCall).toBeDefined();
        });

        it('should fail with 401 if refresh token does not exist', async () => {
            db.query.mockResolvedValue([[], []]);

            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'non_existent_token' });

            expect(res.statusCode).toBe(401);
        });
    });

    describe('Session Revocation (POST /api/auth/revoke)', () => {
        it('should delete the refresh token from the database', async () => {
            const mockRefreshToken = 'active_refresh_token_string';
            db.query.mockResolvedValue([{ affectedRows: 1 }, []]);

            const res = await request(app)
                .post('/api/auth/revoke')
                .send({ refreshToken: mockRefreshToken });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('message', 'Token revoked successfully');

            const deleteCall = db.query.mock.calls.find(c => c[0] && c[0].toUpperCase().includes('DELETE FROM REFRESH_TOKENS'));
            expect(deleteCall).toBeDefined();
            expect(deleteCall[1]).toEqual([mockRefreshToken]);
        });
    });
});
