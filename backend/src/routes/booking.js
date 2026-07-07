const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('../middleware/validateRequest');
const { authenticate } = require('../middleware/authenticate');
const bookingService = require('../services/bookingService');
const { predictConsultationDuration } = require('../services/durationPrediction');
const exportService = require('../services/exportService');
const db = require('../config/db');
const logger = require('../config/logger');

const bookSchema = Joi.object({
    doctorId: Joi.number().required(),
    patientId: Joi.number().integer().positive().optional(),
    date: Joi.string().isoDate().required().custom((value, helpers) => {
        const todayStr = bookingService.getTodayDateString();
        const inputDateStr = bookingService.toDateString(value);
        if (inputDateStr < todayStr) {
            return helpers.message('Cannot book appointments in the past');
        }
        return value;
    }),
    timeSlot: Joi.string().required(),
    symptoms: Joi.string().allow('', null)
});

const predictDurationQuerySchema = Joi.object({
    doctorId: Joi.number().required(),
    patientId: Joi.number().allow(null),
    symptoms: Joi.string().allow('', null),
    timeSlot: Joi.string().allow('', null)
});

// Helper start hour minute parser for booking validations
function parseStartHourMinute(timeStr) {
    if (!timeStr) return null;
    const rangeParts = timeStr.split(/[–\-—]/);
    const startPart = rangeParts[0].trim();
    const ampmMatch = startPart.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (ampmMatch) {
        let hours = parseInt(ampmMatch[1], 10);
        const minutes = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return { hours, minutes };
    }
    const simpleMatch = startPart.match(/(\d+):(\d+)/);
    if (simpleMatch) {
        const hours = parseInt(simpleMatch[1], 10);
        const minutes = parseInt(simpleMatch[2], 10);
        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            return { hours, minutes };
        }
    }
    return null;
}

// POST /api/appointments/book — book appointment
router.post('/book', authenticate, validateRequest(bookSchema), async (req, res) => {
    try {
        const { doctorId, date, timeSlot, symptoms } = req.body;
        const formattedDate = bookingService.toDateString(date);
        const patientId = req.user.role === 'PATIENT' ? req.user.id : req.body.patientId;

        // Validate that if appointment date is today, the slot starting time is in the future
        const todayStr = bookingService.getTodayDateString();
        if (formattedDate === todayStr) {
            const parsedTime = parseStartHourMinute(timeSlot);
            if (parsedTime) {
                const slotTime = new Date();
                slotTime.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
                if (slotTime < new Date()) {
                    return res.status(400).json({ message: 'Cannot book a time slot that has already passed today' });
                }
            }
        }

        if (!patientId) {
            return res.status(400).json({ message: 'Patient ID is required' });
        }

        const result = await bookingService.bookAppointment({
            doctorId,
            date,
            timeSlot,
            symptoms,
            patientId,
            reqUser: req.user
        });

        res.status(201).json({
            message: 'Appointment booked successfully',
            appointmentId: result.appointmentId,
            queueNumber: result.queueNumber,
            estimatedWaitMinutes: result.estimatedWaitMinutes
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        }
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'This time slot has already been booked. Please choose a different slot.' });
        }
        logger.error('BOOKING_ERROR:', error);
        res.status(500).json({ message: 'Server error booking appointment' });
    }
});

// GET /api/appointments/predict-duration — predict duration (without booking)
router.get('/predict-duration', authenticate, validateRequest(predictDurationQuerySchema, 'query'), async (req, res) => {
    try {
        const { doctorId, patientId, symptoms, timeSlot } = req.query;

        const prediction = await predictConsultationDuration({
            doctorId: parseInt(doctorId),
            patientId: patientId ? parseInt(patientId) : null,
            symptoms: symptoms || '',
            timeSlot: timeSlot || ''
        });

        res.json(prediction);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Server error predicting duration' });
    }
});

// PATCH /api/appointments/:id/cancel — cancel appointment
router.patch('/:id/cancel', authenticate, async (req, res) => {
    try {
        const result = await bookingService.cancelAppointment(parseInt(req.params.id), req.user);
        res.json(result);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        }
        logger.error(error);
        res.status(500).json({ message: 'Server error cancelling appointment' });
    }
});

// GET /api/appointments/:id/prescription/pdf - Export prescription as PDF
router.get('/:id/prescription/pdf', authenticate, async (req, res) => {
    try {
        const [appt] = await db.query('SELECT patient_id, doctor_id FROM appointments WHERE id = ?', [req.params.id]);
        if (appt.length === 0) return res.status(404).json({ message: 'Appointment not found' });
        
        const isAuthorized = 
            req.user.role === 'ADMIN' ||
            (req.user.role === 'DOCTOR' && parseInt(req.user.id, 10) === parseInt(appt[0].doctor_id, 10)) ||
            (parseInt(req.user.id, 10) === parseInt(appt[0].patient_id, 10));

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=prescription_${req.params.id}.pdf`);
        
        await exportService.generatePrescriptionPDF(req.params.id, res);
    } catch (error) {
        logger.error(error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error exporting PDF' });
        }
    }
});

module.exports = router;
