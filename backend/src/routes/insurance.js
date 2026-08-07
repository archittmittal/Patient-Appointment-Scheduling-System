const express = require('express');
const router = express.Router();
const insuranceService = require('../services/insuranceService');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { logPhiAccess } = require('../middleware/auditLogger');
const db = require('../config/db');
const { safeErrorMessage } = require('../middleware/errorHandler');
const logger = require('../config/logger');

/**
 * @swagger
 * tags:
 *   name: Insurance
 *   description: Patient insurance management, claims, and verification
 */

/**
 * @swagger
 * /api/insurance/providers:
 *   get:
 *     summary: List all active insurance providers
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/providers', authenticate, logPhiAccess('VIEW_PROVIDERS', 'insurance_providers'), async (req, res) => {
    try {
        const providers = await insuranceService.getProviders();
        res.json(providers);
    } catch (error) {
        logger.error(error);
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
 */
router.get('/my', authenticate, requireRole('PATIENT'), logPhiAccess('VIEW_OWN_INSURANCE', 'patient_insurance'), async (req, res) => {
    try {
        const insurance = await insuranceService.getPatientInsurance(req.user.id);
        res.json(insurance);
    } catch (error) {
        logger.error(error);
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
 */
router.post('/save', authenticate, logPhiAccess('SAVE_INSURANCE', 'patient_insurance'), async (req, res) => {
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
        logger.error(error);
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
 */
router.post('/verify/:id', authenticate, logPhiAccess('VERIFY_ELIGIBILITY', 'patient_insurance'), async (req, res) => {
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
        logger.error(error);
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
 */
router.get('/patient/:id', authenticate, logPhiAccess('VIEW_PATIENT_INSURANCE', 'patient_insurance'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' });

        if (req.user.role === 'PATIENT' && req.user.id !== id) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const insurance = await insuranceService.getPatientInsurance(id);
        res.json(insurance);
    } catch (error) {
        logger.error(error);
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
 */
router.get('/all', authenticate, requireRole('ADMIN'), logPhiAccess('VIEW_ALL_INSURANCE', 'patient_insurance'), async (req, res) => {
    try {
        const policies = await insuranceService.getAllPolicies();
        res.json(policies);
    } catch (error) {
        logger.error(error);
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
 */
router.get('/stats', authenticate, requireRole('ADMIN'), logPhiAccess('VIEW_INSURANCE_STATS', 'patient_insurance'), async (req, res) => {
    try {
        const stats = await insuranceService.getAdminStats();
        res.json(stats);
    } catch (error) {
        logger.error(error);
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
 */
router.delete('/:id', authenticate, requireRole('ADMIN'), logPhiAccess('DELETE_INSURANCE', 'patient_insurance'), async (req, res) => {
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
        logger.error(error);
        res.status(500).json({ message: 'Error deleting insurance record' });
    }
});

// --- Claims Tracking Endpoints ---

/**
 * @swagger
 * /api/insurance/claims:
 *   post:
 *     summary: Submit a new insurance claim
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 */
router.post('/claims', authenticate, logPhiAccess('SUBMIT_CLAIM', 'insurance_claims'), async (req, res) => {
    try {
        const { patientInsuranceId, amountBilled } = req.body;
        if (!patientInsuranceId || !amountBilled) {
            return res.status(400).json({ message: 'patientInsuranceId and amountBilled are required' });
        }

        const parsedBilled = parseFloat(amountBilled);
        if (isNaN(parsedBilled) || !isFinite(parsedBilled) || parsedBilled <= 0) {
            return res.status(400).json({ message: 'amountBilled must be a positive finite number' });
        }

        // Verify patient owns this insurance policy or is admin
        const [policy] = await db.query('SELECT patient_id FROM patient_insurance WHERE id = ?', [patientInsuranceId]);
        if (policy.length === 0) {
            return res.status(404).json({ message: 'Insurance policy not found' });
        }

        if (req.user.role === 'PATIENT' && req.user.id !== policy[0].patient_id) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Verify duplicate combination
        const [existingClaim] = await db.query(
            'SELECT id FROM insurance_claims WHERE patient_insurance_id = ? AND amount_billed = ?',
            [patientInsuranceId, parsedBilled]
        );
        if (existingClaim.length > 0) {
            return res.status(409).json({ message: 'A claim with this policy and billed amount already exists.' });
        }

        const claim = await insuranceService.createClaim({ patientInsuranceId, amountBilled: parsedBilled });
        res.status(201).json(claim);
    } catch (error) {
        logger.error(error);
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error submitting claim' });
    }
});

/**
 * @swagger
 * /api/insurance/claims/my:
 *   get:
 *     summary: Get claims history for logged in patient
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/claims/my', authenticate, requireRole('PATIENT'), logPhiAccess('VIEW_OWN_CLAIMS', 'insurance_claims'), async (req, res) => {
    try {
        const claims = await insuranceService.getPatientClaims(req.user.id);
        res.json(claims);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Error fetching claims' });
    }
});

/**
 * @swagger
 * /api/insurance/claims/patient/{patientId}:
 *   get:
 *     summary: Get claims for a specific patient
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/claims/patient/:patientId', authenticate, logPhiAccess('VIEW_PATIENT_CLAIMS', 'insurance_claims'), async (req, res) => {
    try {
        const patientId = parseInt(req.params.patientId);
        if (isNaN(patientId)) return res.status(400).json({ message: 'Invalid patient ID' });

        if (req.user.role === 'PATIENT' && req.user.id !== patientId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const claims = await insuranceService.getPatientClaims(patientId);
        res.json(claims);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Error fetching patient claims' });
    }
});

/**
 * @swagger
 * /api/insurance/claims/all:
 *   get:
 *     summary: Get all insurance claims (Admin only)
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/claims/all', authenticate, requireRole('ADMIN'), logPhiAccess('VIEW_ALL_CLAIMS', 'insurance_claims'), async (req, res) => {
    try {
        const claims = await insuranceService.getAllClaims();
        res.json(claims);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Error fetching all claims' });
    }
});

/**
 * @swagger
 * /api/insurance/claims/{id}:
 *   get:
 *     summary: Get specific claim details
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 */
router.get('/claims/:id', authenticate, logPhiAccess('VIEW_CLAIM_DETAILS', 'insurance_claims'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' });

        const claim = await insuranceService.getClaimById(id);
        if (!claim) return res.status(404).json({ message: 'Claim not found' });

        if (req.user.role === 'PATIENT' && req.user.id !== claim.patient_id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(claim);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Error fetching claim details' });
    }
});

/**
 * @swagger
 * /api/insurance/claims/{id}:
 *   patch:
 *     summary: Update claim status or covered amount (Admin only)
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/claims/:id', authenticate, requireRole('ADMIN'), logPhiAccess('UPDATE_CLAIM', 'insurance_claims'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' });

        const updated = await insuranceService.updateClaim(id, req.body);
        res.json(updated);
    } catch (error) {
        logger.error(error);
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error updating claim' });
    }
});

/**
 * @swagger
 * /api/insurance/claims/{id}:
 *   delete:
 *     summary: Delete a claim (Admin only)
 *     tags: [Insurance]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/claims/:id', authenticate, requireRole('ADMIN'), logPhiAccess('DELETE_CLAIM', 'insurance_claims'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' });

        await insuranceService.deleteClaim(id);
        res.json({ message: 'Claim deleted successfully' });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Error deleting claim' });
    }
});

module.exports = router;
