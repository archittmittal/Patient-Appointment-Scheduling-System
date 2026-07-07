const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { DEFAULT_PREDICTED_DURATION } = require('../config/constants');
const logger = require('../config/logger');

// GET /api/appointments/analytics/doctor/:doctorId
router.get('/analytics/doctor/:doctorId', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const doctorId = req.params.doctorId;

        if (req.user.role === 'DOCTOR' && parseInt(req.user.id) !== parseInt(doctorId)) {
            return res.status(403).json({ message: 'Access denied: You can only view your own analytics' });
        }

        // Get doctor's average times
        const [avgTimesRows] = await db.query(
            `SELECT * FROM doctor_avg_times WHERE doctor_id = ?`,
            [doctorId]
        );
        const avgTimes = avgTimesRows[0];

        // Get consultation history stats
        const [historyStatsRows] = await db.query(`
            SELECT 
                COUNT(*) as total_consultations,
                AVG(actual_duration_mins) as avg_duration,
                MIN(actual_duration_mins) as min_duration,
                MAX(actual_duration_mins) as max_duration,
                STDDEV(actual_duration_mins) as std_deviation
            FROM consultation_history
            WHERE doctor_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        `, [doctorId]);
        const historyStats = historyStatsRows[0];

        // Get day-wise patterns
        const [dayPatterns] = await db.query(`
            SELECT 
                day_of_week,
                AVG(actual_duration_mins) as avg_duration,
                COUNT(*) as count
            FROM consultation_history
            WHERE doctor_id = ?
            GROUP BY day_of_week
            ORDER BY day_of_week
        `, [doctorId]);

        // Get hour-wise patterns
        const [hourPatterns] = await db.query(`
            SELECT 
                hour_of_day,
                AVG(actual_duration_mins) as avg_duration,
                COUNT(*) as count
            FROM consultation_history
            WHERE doctor_id = ?
            GROUP BY hour_of_day
            ORDER BY hour_of_day
        `, [doctorId]);

        // Get prediction accuracy
        const [accuracyRows] = await db.query(`
            SELECT 
                AVG(ABS(predicted_duration_mins - actual_duration_mins)) as avg_error,
                AVG(CASE WHEN ABS(predicted_duration_mins - actual_duration_mins) <= 5 THEN 1 ELSE 0 END) * 100 as accuracy_within_5min
            FROM appointments
            WHERE doctor_id = ? 
              AND actual_duration_mins IS NOT NULL 
              AND predicted_duration_mins IS NOT NULL
        `, [doctorId]);
        const accuracy = accuracyRows[0];

        const defaultDuration = DEFAULT_PREDICTED_DURATION || 15;

        res.json({
            averages: avgTimes || { avg_duration_mins: defaultDuration, total_consultations: 0 },
            historyStats: historyStats || {},
            dayPatterns: dayPatterns || [],
            hourPatterns: hourPatterns || [],
            accuracy: accuracy || { avg_error: null, accuracy_within_5min: null }
        });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error fetching analytics' });
    }
});

// GET /api/appointments/analytics/symptoms
router.get('/analytics/symptoms', authenticate, requireRole(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const [symptoms] = await db.query(
            `SELECT keyword, complexity_score, avg_extra_mins FROM symptom_complexity ORDER BY complexity_score DESC`
        );
        res.json(symptoms);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error fetching symptoms' });
    }
});

module.exports = router;
