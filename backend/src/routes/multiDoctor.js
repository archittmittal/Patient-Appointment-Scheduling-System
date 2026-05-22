/**
 * Issue #43: Multi-Doctor Routing Routes
 * API endpoints for multi-doctor journeys
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const multiDoctorService = require('../services/multiDoctorService');

/**
 * @swagger
 * tags:
 *   name: MultiDoctor
 *   description: Multi-doctor journey coordination, path optimization, and appointment scheduling
 */

/**
 * @swagger
 * /api/multi-doctor/journey:
 *   post:
 *     summary: Create a new multi-doctor journey
 *     tags: [MultiDoctor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointments
 *             properties:
 *               appointments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - doctorId
 *                     - slotId
 *                     - date
 *                     - stopOrder
 *                   properties:
 *                     doctorId:
 *                       type: integer
 *                     slotId:
 *                       type: integer
 *                     date:
 *                       type: string
 *                     stopOrder:
 *                       type: integer
 *                       description: The sequence order of this stop in the journey
 *     responses:
 *       201:
 *         description: Journey created successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden (Only patients can create journeys)
 */
router.post('/journey', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ error: 'Only patients can create journeys' });
        }

        const journey = await multiDoctorService.createJourney(
            req.user.id,
            req.body.appointments
        );
        res.status(201).json(journey);
    } catch (err) {
        console.error('Create journey error:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/multi-doctor/journeys:
 *   get:
 *     summary: Get patient's active journeys
 *     tags: [MultiDoctor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient's journeys retrieved successfully
 *       403:
 *         description: Access denied (if user is not a PATIENT)
 *       500:
 *         description: Failed to get journeys
 */
router.get('/journeys', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const journeys = await multiDoctorService.getPatientJourneys(req.user.id);
        res.json(journeys);
    } catch (err) {
        console.error('Get journeys error:', err);
        res.status(500).json({ error: 'Failed to get journeys' });
    }
});

/**
 * @swagger
 * /api/multi-doctor/journey/{journeyId}:
 *   get:
 *     summary: Get journey details
 *     tags: [MultiDoctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: journeyId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Journey details retrieved successfully
 *       400:
 *         description: Bad request
 */
router.get('/journey/:journeyId', authenticate, async (req, res) => {
    try {
        const journey = await multiDoctorService.getJourneyDetails(
            req.params.journeyId,
            req.user.id
        );
        res.json(journey);
    } catch (err) {
        console.error('Get journey details error:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/multi-doctor/stop/{stopId}/status:
 *   patch:
 *     summary: Update stop status (doctor/admin)
 *     tags: [MultiDoctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stopId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, COMPLETED, CANCELLED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stop status updated successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Access denied (if user is not a DOCTOR or ADMIN)
 */
router.patch('/stop/:stopId/status', authenticate, async (req, res) => {
    try {
        if (!['DOCTOR', 'ADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await multiDoctorService.updateStopStatus(
            req.params.stopId,
            req.body.status,
            req.body.notes
        );
        res.json(result);
    } catch (err) {
        console.error('Update stop status error:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/multi-doctor/optimize:
 *   post:
 *     summary: Get route optimization suggestion
 *     tags: [MultiDoctor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctorIds
 *             properties:
 *               doctorIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Route optimization suggestions retrieved successfully
 *       500:
 *         description: Failed to optimize route
 */
router.post('/optimize', authenticate, async (req, res) => {
    try {
        const optimization = await multiDoctorService.getRouteOptimization(
            req.body.doctorIds
        );
        res.json(optimization);
    } catch (err) {
        console.error('Optimize route error:', err);
        res.status(500).json({ error: 'Failed to optimize route' });
    }
});

/**
 * @swagger
 * /api/multi-doctor/suggestions:
 *   get:
 *     summary: Get suggested doctor combinations for symptoms
 *     tags: [MultiDoctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: symptom
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Suggested doctor combinations retrieved successfully
 *       400:
 *         description: Symptom is required
 *       500:
 *         description: Failed to get suggestions
 */
router.get('/suggestions', authenticate, async (req, res) => {
    try {
        const { symptom } = req.query;
        if (!symptom) {
            return res.status(400).json({ error: 'Symptom is required' });
        }

        const suggestions = await multiDoctorService.getSuggestedCombinations(symptom);
        res.json(suggestions);
    } catch (err) {
        console.error('Get suggestions error:', err);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

/**
 * @swagger
 * /api/multi-doctor/coordinate-slots:
 *   post:
 *     summary: Find optimal slot paths for multiple doctors on a date
 *     tags: [MultiDoctor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctorIds
 *               - date
 *             properties:
 *               doctorIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               date:
 *                 type: string
 *     responses:
 *       200:
 *         description: Optimal slot paths retrieved successfully
 *       400:
 *         description: doctorIds (min 2) and date required
 *       500:
 *         description: Failed to coordinate slots
 */
router.post('/coordinate-slots', authenticate, async (req, res) => {
    try {
        const { doctorIds, date } = req.body;
        if (!doctorIds || doctorIds.length < 2 || !date) {
            return res.status(400).json({ error: 'doctorIds (min 2) and date required' });
        }

        const paths = await multiDoctorService.getOptimalSlotPaths(doctorIds, date);
        res.json(paths);
    } catch (err) {
        console.error('Coordinate slots error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @swagger
 * /api/multi-doctor/analytics:
 *   get:
 *     summary: Get journey analytics
 *     tags: [MultiDoctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Journey analytics retrieved successfully
 *       403:
 *         description: Access denied (Requires ADMIN role)
 *       500:
 *         description: Failed to get analytics
 */
router.get('/analytics', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        const analytics = await multiDoctorService.getJourneyAnalytics(start, end);
        res.json(analytics);
    } catch (err) {
        console.error('Get analytics error:', err);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

module.exports = router;
