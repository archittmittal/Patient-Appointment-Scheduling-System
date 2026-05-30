const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const { bcryptRounds } = require('../config/auth');
const sessionService = require('./sessionService');
const { sendOTP } = require('./emailService');

class AuthService {
    async login(email, password) {
        // Fetch user by email
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            const error = new Error('Invalid email or password');
            error.status = 401;
            throw error;
        }

        const user = users[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            const error = new Error('Invalid email or password');
            error.status = 401;
            throw error;
        }

        let firstName = 'Admin';
        let lastName = '';

        if (user.role === 'PATIENT') {
            const [rows] = await db.query('SELECT first_name, last_name FROM patients WHERE id = ?', [user.id]);
            if (rows.length > 0) { firstName = rows[0].first_name; lastName = rows[0].last_name; }
        } else if (user.role === 'DOCTOR') {
            const [rows] = await db.query('SELECT first_name, last_name FROM doctors WHERE id = ?', [user.id]);
            if (rows.length > 0) { firstName = rows[0].first_name; lastName = rows[0].last_name; }
        }

        const token = sessionService.generateToken(user);

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            first_name: firstName,
            last_name: lastName,
            token
        };
    }

    async registerPatient(userData) {
        const { email, password, first_name, last_name, dob, phone, blood_group, address } = userData;
        
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
            if (existing.length > 0) {
                const error = new Error('An account with this email already exists');
                error.status = 409;
                throw error;
            }

            const passwordHash = await bcrypt.hash(password, bcryptRounds);

            const [userResult] = await conn.query(
                'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
                [email, passwordHash, 'PATIENT']
            );
            const newId = userResult.insertId;

            await conn.query(
                'INSERT INTO patients (id, first_name, last_name, dob, phone, blood_group, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [newId, first_name, last_name, dob || null, phone || '', blood_group || '', address || '']
            );

            await conn.commit();

            const token = sessionService.generateToken({ id: newId, email, role: 'PATIENT' });

            return { id: newId, email, role: 'PATIENT', first_name, last_name, token };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async forgotPassword(email) {
        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

        // [SEC-006] Return a generic success message regardless of whether
        // the account exists to prevent user enumeration attacks.
        if (users.length === 0) {
            return { message: 'If an account with that email exists, an OTP has been sent' };
        }

        // [SEC-007] Check if the account is currently locked out from OTP requests
        const [lockRows] = await db.query(
            'SELECT otp_locked_until FROM users WHERE email = ?',
            [email]
        );
        if (lockRows.length > 0 && lockRows[0].otp_locked_until && new Date(lockRows[0].otp_locked_until) > new Date()) {
            const error = new Error('Account is temporarily locked due to too many failed attempts. Please try again later.');
            error.status = 429;
            throw error;
        }

        // [SEC-006] Use crypto.randomInt() for cryptographically secure OTP generation
        // instead of the predictable Math.random()
        const otp = crypto.randomInt(100000, 1000000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        // Reset failed attempts on new OTP generation
        await db.query(
            'UPDATE users SET otp_code = ?, otp_expiry = ?, failed_otp_attempts = 0 WHERE email = ?',
            [otp, expiry, email]
        );

        await sendOTP(email, otp);
        return { message: 'If an account with that email exists, an OTP has been sent' };
    }

    async resetPassword(email, otp, newPassword) {
        // [SEC-007] Check if account is locked out
        const [lockCheck] = await db.query(
            'SELECT otp_locked_until, failed_otp_attempts FROM users WHERE email = ?',
            [email]
        );
        if (lockCheck.length > 0 && lockCheck[0].otp_locked_until && new Date(lockCheck[0].otp_locked_until) > new Date()) {
            const error = new Error('Account is temporarily locked due to too many failed attempts. Please try again later.');
            error.status = 429;
            throw error;
        }

        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? AND otp_code = ? AND otp_expiry > NOW()',
            [email, otp]
        );

        if (users.length === 0) {
            // [SEC-007] Increment failed attempt counter and lock after 5 failures
            const MAX_OTP_ATTEMPTS = 5;
            const LOCKOUT_MINUTES = 15;

            await db.query(
                'UPDATE users SET failed_otp_attempts = COALESCE(failed_otp_attempts, 0) + 1 WHERE email = ?',
                [email]
            );

            // Check if we've exceeded max attempts
            const [updated] = await db.query(
                'SELECT failed_otp_attempts FROM users WHERE email = ?',
                [email]
            );
            if (updated.length > 0 && updated[0].failed_otp_attempts >= MAX_OTP_ATTEMPTS) {
                const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
                await db.query(
                    'UPDATE users SET otp_locked_until = ?, otp_code = NULL, otp_expiry = NULL WHERE email = ?',
                    [lockUntil, email]
                );
                const error = new Error(`Account locked for ${LOCKOUT_MINUTES} minutes after ${MAX_OTP_ATTEMPTS} failed OTP attempts`);
                error.status = 429;
                throw error;
            }

            const error = new Error('Invalid or expired OTP');
            error.status = 400;
            throw error;
        }

        // Success — reset password and clear all OTP state
        const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
        await db.query(
            'UPDATE users SET password_hash = ?, otp_code = NULL, otp_expiry = NULL, failed_otp_attempts = 0, otp_locked_until = NULL WHERE email = ?',
            [passwordHash, email]
        );

        return { message: 'Password reset successful' };
    }
}

module.exports = new AuthService();
