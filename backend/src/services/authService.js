const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/db');
const { bcryptRounds } = require('../config/auth');
const sessionService = require('./sessionService');
const { sendOTP } = require('./emailService');
const GENERIC_OTP_MESSAGE = 'If an account with that email exists, an OTP has been sent';

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
        if (user.auth_provider === 'GOOGLE' || !user.password_hash) {
            const error = new Error('This account uses Google Sign-In. Please sign in with Google.');
            error.status = 401;
            throw error;
        }
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
        const { email, password, first_name, last_name, dob, phone, blood_group, address, abha_id, abha_number } = userData;
        
        const abhaService = require('./abhaService');
        if (abha_id && !abhaService.validateAbhaAddress(abha_id)) {
            const error = new Error('Invalid ABHA ID format');
            error.status = 400;
            throw error;
        }
        if (abha_number && !abhaService.validateAbhaNumber(abha_number)) {
            const error = new Error('Invalid ABHA Number format');
            error.status = 400;
            throw error;
        }

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
                'INSERT INTO patients (id, first_name, last_name, dob, phone, blood_group, address, abha_id, abha_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newId, first_name, last_name, dob || null, phone || '', blood_group || '', address || '', abha_id || null, abha_number || null]
            );

            await conn.commit();

            const token = sessionService.generateToken({ id: newId, email, role: 'PATIENT' });

            return { id: newId, email, role: 'PATIENT', first_name, last_name, token, abha_id: abha_id || null, abha_number: abha_number || null };
        } catch (error) {
            await conn.rollback();
            if (error.code === 'ER_DUP_ENTRY') {
                const message = error.message.includes('abha_id') 
                    ? 'This ABHA ID is already linked to another account'
                    : error.message.includes('abha_number')
                    ? 'This ABHA Number is already linked to another account'
                    : 'An account with these details already exists';
                const err = new Error(message);
                err.status = 409;
                throw err;
            }
            throw error;
        } finally {
            conn.release();
        }
    }

    async forgotPassword(email) {
        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        const MIN_RESPONSE_DELAY_MS = 200;

        if (users.length > 0) {
            setImmediate(async () => {
                try {
                    // [SEC-007] Skip OTP regeneration while account is locked
                    const [lockRows] = await db.query(
                        'SELECT otp_locked_until FROM users WHERE email = ?',
                        [email]
                    );
                    if (lockRows.length > 0 && lockRows[0].otp_locked_until && new Date(lockRows[0].otp_locked_until) > new Date()) {
                        return;
                    }

                    // [SEC-006] Use crypto.randomInt() for cryptographically secure OTP generation
                    // instead of the predictable Math.random()
                    const otp = crypto.randomInt(100000, 1000000).toString();
                    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
                    const hashedOtp = await bcrypt.hash(otp, bcryptRounds);

                    // Reset failed attempts on new OTP generation
                    await db.query(
                        'UPDATE users SET otp_code = ?, otp_expiry = ?, failed_otp_attempts = 0 WHERE email = ?',
                        [hashedOtp, expiry, email]
                    );

                    await sendOTP(email, otp);
                } catch (error) {
                    console.error('Forgot password side effect error:', error);
                }
            });
        }

        await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_DELAY_MS));
        return { message: GENERIC_OTP_MESSAGE };
    }

    async resetPassword(email, otp, newPassword) {
        // [SEC-007] Check if account is locked out
        const [lockCheck] = await db.query(
            'SELECT otp_locked_until, failed_otp_attempts FROM users WHERE email = ?',
            [email]
        );
        if (lockCheck.length > 0 && lockCheck[0].otp_locked_until && new Date(lockCheck[0].otp_locked_until) > new Date()) {
            const error = new Error('Invalid or expired OTP');
            error.status = 400;
            throw error;
        }

        const [users] = await db.query(
            'SELECT id, otp_code, otp_expiry FROM users WHERE email = ?',
            [email]
        );

        let otpValid = false;
        if (users.length > 0 && users[0].otp_code && users[0].otp_expiry && new Date(users[0].otp_expiry) > new Date()) {
            otpValid = await bcrypt.compare(otp, users[0].otp_code);
        }

        if (!otpValid) {
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
                const error = new Error('Invalid or expired OTP');
                error.status = 400;
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

    async googleLogin(idToken) {
        if (!process.env.GOOGLE_CLIENT_ID) {
            const error = new Error('Google OAuth is not configured');
            error.status = 500;
            throw error;
        }

        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        let ticket;
        try {
            ticket = await client.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
        } catch (err) {
            const error = new Error('Invalid Google ID token');
            error.status = 401;
            throw error;
        }
        
        const payload = ticket.getPayload();
        if (!payload?.email || !payload?.sub || payload.email_verified !== true) {
            const error = new Error('Invalid Google token');
            error.status = 401;
            throw error;
        }
        const { sub: googleId, email, given_name, family_name } = payload;

        // Check if user exists
        let [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        let user = users[0];

        if (!user) {
            // New user, auto-register as PATIENT
            const conn = await db.getConnection();
            try {
                await conn.beginTransaction();

                const [result] = await conn.query(
                    'INSERT INTO users (email, role, auth_provider, google_id) VALUES (?, ?, ?, ?)',
                    [email, 'PATIENT', 'GOOGLE', googleId]
                );
                
                const newId = result.insertId;

                await conn.query(
                    'INSERT INTO patients (id, first_name, last_name) VALUES (?, ?, ?)',
                    [newId, given_name || 'Patient', family_name || 'User']
                );

                await conn.commit();
                user = { id: newId, email, role: 'PATIENT' };
            } catch (error) {
                await conn.rollback();
                throw error;
            } finally {
                conn.release();
            }
        } else {
            // Existing user, link google_id if empty
            if (!user.google_id) {
                try {
                    const [existingGoogleUsers] = await db.query('SELECT id FROM users WHERE google_id = ?', [googleId]);
                    if (existingGoogleUsers.length > 0 && existingGoogleUsers[0].id !== user.id) {
                        const error = new Error('Google account mismatch');
                        error.status = 401;
                        throw error;
                    }
                    await db.query('UPDATE users SET auth_provider = ?, google_id = ? WHERE id = ?', ['GOOGLE', googleId, user.id]);
                } catch (err) {
                    if (err.status === 401) throw err;
                    const error = new Error('Google account mismatch');
                    error.status = 401;
                    throw error;
                }
            } else if (user.google_id !== googleId) {
                const error = new Error('Google account mismatch');
                error.status = 401;
                throw error;
            }
        }

        // Get names for the response
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
}

module.exports = new AuthService();
