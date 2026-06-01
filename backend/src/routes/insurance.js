const express = require('express');
const router = express.Router();
const insuranceService = require('../services/insuranceService');
const { authenticate, requireRole } = require('../middleware/authenticate');
const db = require('../config/db');
const { safeErrorMessage } = require('../middleware/errorHandler');

/**
 * @swagger
 * tags:
 *   name: Insurance
 *   description: Patient insurance management and verification
 */

/**
 * @swagger
 * /api/insurance/providers:
 *   get:
 *     summary: List all active insurance providers
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of insurance providers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   code:
 *                     type: string
 *                   is_active:
 *                     type: boolean
 *       500:
 *         description: Error fetching providers
 */
router.get('/providers', authenticate, async (req, res) => {
    try {
        const providers = await insuranceService.getProviders();
        res.json(providers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching providers' });
    }
});

/**
 * @swagger
 * /api/insurance/my:
 *   get:
 *     summary: Get logged in patient's insurance details
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient's insurance details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 patient_id:
 *                   type: integer
 *                 provider_id:
 *                   type: integer
 *                 policy_number:
 *                   type: string
 *                 group_number:
 *                   type: string
 *                 status:
 *                   type: string
 *       500:
 *         description: Error fetching your insurance
 */
router.get('/my', authenticate, requireRole('PATIENT'), async (req, res) => {
    try {
        const insurance = await insuranceService.getPatientInsurance(req.user.id);
        res.json(insurance);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching your insurance' });
    }
});

/**
 * @swagger
 * /api/insurance/save:
 *   post:
 *     summary: Save or update patient's insurance details
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - providerId
 *               - policyNumber
 *             properties:
 *               patientId:
 *                 type: integer
 *                 description: Required only if req.user.role is ADMIN
 *               providerId:
 *                 type: integer
 *               policyNumber:
 *                 type: string
 *               groupNumber:
 *                 type: string
 *               coverageDetails:
 *                 type: object
 *     responses:
 *       200:
 *         description: Insurance details updated successfully
 *       201:
 *         description: Insurance details created successfully
 *       400:
 *         description: Bad request (e.g. missing patientId for admin)
 *       403:
 *         description: Forbidden (patientId specified without ADMIN role, or unauthorized)
 *       500:
 *         description: Error saving insurance
 */
router.post('/save', authenticate, async (req, res) => {
    try {
        let patientId = req.user.id;
        
        // If admin, they must specify which patient this belongs to
        if (req.user.role === 'ADMIN') {
            if (!req.body.patientId) {
                return res.status(400).json({ message: 'patientId is required for admin saves' });
            }
            patientId = req.body.patientId;
        } else if (req.user.role !== 'PATIENT') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const result = await insuranceService.saveInsurance(patientId, req.body);
        res.status(result.action === 'CREATED' ? 201 : 200).json(result);
    } catch (error) {
        console.error(error);
        // SEC-010: Do not leak internal error detail to clients in production
        res.status(500).json({ message: safeErrorMessage(error, 'Error saving insurance') });
    }
});

/**
 * @swagger
 * /api/insurance/verify/{id}:
 *   post:
 *     summary: Verify eligibility for a specific insurance record
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the insurance record to verify
 *     responses:
 *       200:
 *         description: Insurance eligibility verified successfully
 *       400:
 *         description: Invalid ID
 *       403:
 *         description: Forbidden (You can only verify your own insurance)
 *       404:
 *         description: Insurance record not found
 *       500:
 *         description: Error verifying eligibility
 */
router.post('/verify/:id', authenticate, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' });

        // Check if user is allowed to verify (Patient for self, or Admin/Staff)
        const [insurance] = await db.query('SELECT patient_id FROM patient_insurance WHERE id = ?', [id]);
        
        if (insurance.length === 0) {
            return res.status(404).json({ message: 'Insurance record not found' });
        }

        if (req.user.role === 'PATIENT' && req.user.id !== insurance[0].patient_id) {
            return res.status(403).json({ message: 'You can only verify your own insurance' });
        }

        const result = await insuranceService.verifyEligibility(id);
        res.json(result);
    } catch (error) {
        console.error(error);
        // SEC-010: Do not leak internal error detail to clients in production
        res.status(500).json({ message: safeErrorMessage(error, 'Error verifying eligibility') });
    }
});

/**
 * @swagger
 * /api/insurance/patient/{id}:
 *   get:
 *     summary: Get insurance details for a specific patient
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the patient
 *     responses:
 *       200:
 *         description: Insurance details retrieved successfully
 *       400:
 *         description: Invalid ID
 *       403:
 *         description: Access denied (if PATIENT and requests another patient's data)
 *       500:
 *         description: Error fetching patient insurance
 */
router.get('/patient/:id', authenticate, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' });

        if (req.user.role === 'PATIENT' && req.user.id !== id) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const insurance = await insuranceService.getPatientInsurance(id);
        res.json(insurance);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching patient insurance' });
    }
});

/**
 * @swagger
 * /api/insurance/all:
 *   get:
 *     summary: Get all insurance policies
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All insurance policies retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 *       500:
 *         description: Error fetching all policies
 */
router.get('/all', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const policies = await insuranceService.getAllPolicies();
        res.json(policies);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching all policies' });
    }
});

/**
 * @swagger
 * /api/insurance/stats:
 *   get:
 *     summary: Get insurance analytics
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Insurance analytics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 *       500:
 *         description: Error fetching insurance stats
 */
router.get('/stats', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const stats = await insuranceService.getAdminStats();
        res.json(stats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching insurance stats' });
    }
});

/**
 * @swagger
 * /api/insurance/{id}:
 *   delete:
 *     summary: Delete an insurance record
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the insurance record to delete
 *     responses:
 *       200:
 *         description: Insurance record deleted successfully
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires ADMIN role)
 *       404:
 *         description: Insurance record not found
 *       500:
 *         description: Error deleting insurance record
 */
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' });
        
        // Ensure record exists
        const [existing] = await db.query('SELECT id FROM patient_insurance WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Insurance record not found' });
        }

        await db.query('DELETE FROM patient_insurance WHERE id = ?', [id]);
        res.json({ message: 'Insurance record deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting insurance record' });
    }
});

module.exports = router;
