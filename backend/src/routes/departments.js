const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * @swagger
 * tags:
 *   name: Departments
 *   description: Public department directory
 */

/**
 * @swagger
 * /api/departments:
 *   get:
 *     summary: Get all departments
 *     tags: [Departments]
 *     responses:
 *       200:
 *         description: List of departments retrieved successfully
 */
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, name, description, created_at FROM departments ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
