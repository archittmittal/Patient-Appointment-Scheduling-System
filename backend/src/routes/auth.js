const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { authSchemas } = require('../schemas');


const BCRYPT_ROUNDS = 10;

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and registration
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login to the system
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validate(authSchemas.login), async (req, res, next) => {
    try {
        const { email, password } = req.body;


        // Fetch user by email only; compare password separately (never compare in SQL)
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = users[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
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

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            id: user.id,
            email: user.email,
            role: user.role,
            first_name: firstName,
            last_name: lastName,
            token,
        });
    } catch (error) {
        next(error);
    }
});


/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new patient
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - first_name
 *               - last_name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               dob:
 *                 type: string
 *                 format: date
 *               phone:
 *                 type: string
 *               blood_group:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registration successful
 *       409:
 *         description: Email already exists
 *       400:
 *         description: Missing required fields
 */
router.post('/register', validate(authSchemas.register), async (req, res, next) => {
    const conn = await db.getConnection();
    try {
        const { email, password, first_name, last_name, dob, phone, blood_group, address } = req.body;


        const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'An account with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        await conn.beginTransaction();

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

        const token = jwt.sign(
            { id: newId, email: email, role: 'PATIENT' },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(201).json({ id: newId, email, role: 'PATIENT', first_name, last_name, token });
    } catch (error) {
        await conn.rollback();
        next(error);
    } finally {

        conn.release();
    }
});

const { sendOTP } = require('../services/emailService');

// ... existing code ...

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send OTP for password reset
 *     tags: [Auth]
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });

        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            // Don't reveal if email exists for security, but user wants functionality
            return res.status(404).json({ message: 'User not found' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await db.query(
            'UPDATE users SET otp_code = ?, otp_expiry = ? WHERE email = ?',
            [otp, expiry, email]
        );

        await sendOTP(email, otp);
        res.json({ message: 'OTP sent to your email' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error sending OTP' });
    }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Auth]
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP and new password are required' });
        }

        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? AND otp_code = ? AND otp_expiry > NOW()',
            [email, otp]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await db.query(
            'UPDATE users SET password_hash = ?, otp_code = NULL, otp_expiry = NULL WHERE email = ?',
            [passwordHash, email]
        );

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error resetting password' });
    }
});

module.exports = router;

