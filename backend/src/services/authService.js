const bcrypt = require('bcryptjs');
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
        if (users.length === 0) {
            const error = new Error('User not found');
            error.status = 404;
            throw error;
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await db.query(
            'UPDATE users SET otp_code = ?, otp_expiry = ? WHERE email = ?',
            [otp, expiry, email]
        );

        await sendOTP(email, otp);
        return { message: 'OTP sent to your email' };
    }

    async resetPassword(email, otp, newPassword) {
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? AND otp_code = ? AND otp_expiry > NOW()',
            [email, otp]
        );

        if (users.length === 0) {
            const error = new Error('Invalid or expired OTP');
            error.status = 400;
            throw error;
        }

        const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
        await db.query(
            'UPDATE users SET password_hash = ?, otp_code = NULL, otp_expiry = NULL WHERE email = ?',
            [passwordHash, email]
        );

        return { message: 'Password reset successful' };
    }
}

module.exports = new AuthService();
