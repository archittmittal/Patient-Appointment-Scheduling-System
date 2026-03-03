const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/authenticate');

const BCRYPT_ROUNDS = 10;

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

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
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/register  (patients only — doctors are assigned by admin)
router.post('/register', async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { email, password, first_name, last_name, dob, phone, blood_group, address } = req.body;

        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({ message: 'Email, password, first name and last name are required' });
        }

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

        res.status(201).json({ id: newId, email, role: 'PATIENT', first_name, last_name });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ message: 'Server error during registration' });
    } finally {
        conn.release();
    }
});

module.exports = router;
