const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../config/db');
const validateRequest = require('../middleware/validateRequest');
const { authenticate, requireRole } = require('../middleware/authenticate');
const waitlistService = require('../services/waitlistService');
const logger = require('../config/logger');

const joinWaitlistSchema = Joi.object({
    doctorId: Joi.number().required(),
    preferredDate: Joi.string().isoDate().required(),
    timePreference: Joi.string().valid('MORNING', 'AFTERNOON', 'EVENING', 'ANY').default('ANY'),
    maxNoticeHours: Joi.number().integer().min(1).max(72).default(24),
    reason: Joi.string().max(255).allow('', null)
});

// Helper to resolve patient ID and check profile existence
async function resolvePatient(userId) {
    const [rows] = await db.query(
        'SELECT id FROM patients WHERE id = ?',
        [userId]
    );
    return rows[0] || null;
}

// POST /api/appointments/waitlist/join
router.post('/waitlist/join', authenticate, validateRequest(joinWaitlistSchema), async (req, res) => {
    try {
        const { doctorId, preferredDate, timePreference, maxNoticeHours, reason } = req.body;
        
        // Get patient ID from user
        const patient = await resolvePatient(req.user.id);
        
        if (!patient) {
            return res.status(400).json({ message: 'Patient profile not found' });
        }

        const result = await waitlistService.joinWaitlist(patient.id, doctorId, {
            preferredDate,
            timePreference,
            maxNoticeHours,
            reason
        });

        if (!result.success) {
            return res.status(400).json({ message: result.error });
        }

        res.status(201).json(result);
    } catch (error) {
        logger.error('Join waitlist error:', error);
        res.status(500).json({ message: 'Server error joining waitlist' });
    }
});

// DELETE /api/appointments/waitlist/:id - Leave waitlist
router.delete('/waitlist/:id', authenticate, async (req, res) => {
    try {
        const patient = await resolvePatient(req.user.id);

        if (!patient) {
            return res.status(400).json({ message: 'Patient profile not found' });
        }

        const result = await waitlistService.leaveWaitlist(parseInt(req.params.id), patient.id);
        
        if (!result.success) {
            return res.status(404).json({ message: 'Waitlist entry not found' });
        }

        res.json({ message: 'Removed from waitlist' });
    } catch (error) {
        logger.error('Leave waitlist error:', error);
        res.status(500).json({ message: 'Server error leaving waitlist' });
    }
});

// GET /api/appointments/waitlist/my - Get patient's waitlist entries
router.get('/waitlist/my', authenticate, async (req, res) => {
    try {
        const patient = await resolvePatient(req.user.id);

        if (!patient) {
            return res.json([]);
        }

        const entries = await waitlistService.getPatientWaitlist(patient.id);
        res.json(entries);
    } catch (error) {
        logger.error('Get patient waitlist error:', error);
        res.status(500).json({ message: 'Server error fetching waitlist' });
    }
});

// GET /api/appointments/waitlist/offers - Get pending slot offers for patient
router.get('/waitlist/offers', authenticate, async (req, res) => {
    try {
        const patient = await resolvePatient(req.user.id);

        if (!patient) {
            return res.json([]);
        }

        const offers = await waitlistService.getPatientOffers(patient.id);
        res.json(offers);
    } catch (error) {
        logger.error('Get offers error:', error);
        res.status(500).json({ message: 'Server error fetching offers' });
    }
});

// POST /api/appointments/waitlist/offers/:id/accept - Accept a slot offer
router.post('/waitlist/offers/:id/accept', authenticate, async (req, res) => {
    try {
        const patient = await resolvePatient(req.user.id);

        if (!patient) {
            return res.status(400).json({ message: 'Patient profile not found' });
        }

        const result = await waitlistService.acceptSlotOffer(parseInt(req.params.id), patient.id);
        
        if (!result.success) {
            return res.status(400).json({ message: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error('Accept offer error:', error);
        res.status(500).json({ message: 'Server error accepting offer' });
    }
});

// POST /api/appointments/waitlist/offers/:id/decline - Decline a slot offer
router.post('/waitlist/offers/:id/decline', authenticate, async (req, res) => {
    try {
        const patient = await resolvePatient(req.user.id);

        if (!patient) {
            return res.status(400).json({ message: 'Patient profile not found' });
        }

        const result = await waitlistService.declineSlotOffer(parseInt(req.params.id), patient.id);
        
        if (!result.success) {
            return res.status(400).json({ message: result.error });
        }

        res.json({ message: 'Offer declined' });
    } catch (error) {
        logger.error('Decline offer error:', error);
        res.status(500).json({ message: 'Server error declining offer' });
    }
});

// POST /api/appointments/waitlist/cleanup - Clean up expired entries (admin/cron)
router.post('/waitlist/cleanup', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const result = await waitlistService.cleanupExpired();
        res.json({ message: 'Cleanup complete', ...result });
    } catch (error) {
        logger.error('Cleanup error:', error);
        res.status(500).json({ message: 'Server error during cleanup' });
    }
});

module.exports = router;
