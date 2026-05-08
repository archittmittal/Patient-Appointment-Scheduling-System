const express = require('express');
const router = express.Router();
const insuranceService = require('../services/insuranceService');
const { authenticate, requireRole } = require('../middleware/authenticate');
const db = require('../config/db');

/**
 * GET /api/insurance/providers
 * List all active insurance providers
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
 * GET /api/insurance/my
 * Get logged in patient's insurance details
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
 * POST /api/insurance/save
 * Save or update patient's insurance details
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
        res.status(500).json({ message: error.message || 'Error saving insurance' });
    }
});

/**
 * POST /api/insurance/verify/:id
 * Verify eligibility for a specific insurance record
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
        res.status(500).json({ message: error.message || 'Error verifying eligibility' });
    }
});

/**
 * GET /api/insurance/patient/:id
 * Get insurance details for a specific patient (Admin/Staff only)
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
 * GET /api/insurance/all
 * Get all insurance policies (Admin only)
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
 * GET /api/insurance/stats
 * Get insurance analytics (Admin only)
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
 * DELETE /api/insurance/:id
 * Delete an insurance record (Admin only)
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
