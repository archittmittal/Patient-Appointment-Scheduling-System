const express = require('express');
const router = express.require ? express.Router() : express.Router();
const db = require('../config/db');

// Get all doctors
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM doctors');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a single doctor by ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Doctor not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mock endpoint for doctor reviews (assuming reviews are on doctor profile)
router.get('/:id/reviews', async (req, res) => {
    try {
        // In a real app, this would query a reviews table based on doctor_id.
        // For now, we return mock reviews.
        const reviews = [
            {
                id: 1,
                name: "Alice Walker",
                rating: 5.0,
                date: "2 days ago",
                comment: "Dr. Jenkins is incredibly thorough and takes the time to explain everything clearly. Highly recommended.",
                avatar: "https://ui-avatars.com/api/?name=Alice+Walker&background=random"
            },
            {
                id: 2,
                name: "David Chen",
                rating: 4.5,
                date: "1 week ago",
                comment: "Very professional and the clinic is well-equipped.",
                avatar: "https://ui-avatars.com/api/?name=David+Chen&background=random"
            }
        ];
        res.json(reviews);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
