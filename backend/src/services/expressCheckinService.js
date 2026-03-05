/**
 * Issue #45: Express Check-in Service
 * Fast-track check-in for returning patients and follow-ups
 */

const db = require('../config/db');
const crypto = require('crypto');

const expressCheckinService = {
    /**
     * Generate QR code token for express check-in
     */
    async generateCheckinToken(appointmentId, patientId) {
        // Verify appointment belongs to patient
        const [appointments] = await db.query(
            `SELECT a.*, u.first_name, u.last_name, d.first_name as doc_first, d.last_name as doc_last
             FROM appointments a
             JOIN users u ON a.patient_id = u.id
             JOIN users d ON a.doctor_id = d.id
             WHERE a.id = ? AND a.patient_id = ?`,
            [appointmentId, patientId]
        );

        if (!appointments.length) {
            throw new Error('Appointment not found or unauthorized');
        }

        const apt = appointments[0];
        
        // Check if already checked in
        if (['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(apt.status)) {
            throw new Error('Already checked in for this appointment');
        }

        // Generate unique token
        const token = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Store token
        await db.query(
            `INSERT INTO checkin_tokens (appointment_id, patient_id, token, expires_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)`,
            [appointmentId, patientId, token, expiresAt]
        );

        return {
            token,
            expiresAt: expiresAt.toISOString(),
            qrData: JSON.stringify({
                type: 'EXPRESS_CHECKIN',
                token,
                appointmentId,
                patientName: `${apt.first_name} ${apt.last_name}`,
                doctor: `Dr. ${apt.doc_first} ${apt.doc_last}`,
                date: apt.appointment_date,
                time: apt.time_slot
            })
        };
    },

    /**
     * Validate and process express check-in via token
     */
    async processExpressCheckin(token) {
        // Find and validate token
        const [tokens] = await db.query(
            `SELECT ct.*, a.status as apt_status, a.patient_id, a.doctor_id,
                    u.first_name, u.last_name
             FROM checkin_tokens ct
             JOIN appointments a ON ct.appointment_id = a.id
             JOIN users u ON a.patient_id = u.id
             WHERE ct.token = ? AND ct.expires_at > NOW() AND ct.used = FALSE`,
            [token]
        );

        if (!tokens.length) {
            throw new Error('Invalid or expired check-in token');
        }

        const tokenData = tokens[0];

        if (['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(tokenData.apt_status)) {
            throw new Error('Already checked in for this appointment');
        }

        // Update appointment status
        await db.query(
            `UPDATE appointments 
             SET status = 'CHECKED_IN', 
                 checked_in_at = NOW(),
                 checkin_method = 'EXPRESS'
             WHERE id = ?`,
            [tokenData.appointment_id]
        );

        // Mark token as used
        await db.query(
            `UPDATE checkin_tokens SET used = TRUE, used_at = NOW() WHERE token = ?`,
            [token]
        );

        // Get queue position
        const [queuePos] = await db.query(
            `SELECT COUNT(*) + 1 as position
             FROM appointments
             WHERE doctor_id = ? 
               AND DATE(appointment_date) = CURDATE()
               AND status = 'CHECKED_IN'
               AND checked_in_at < (SELECT checked_in_at FROM appointments WHERE id = ?)`,
            [tokenData.doctor_id, tokenData.appointment_id]
        );

        return {
            success: true,
            message: 'Express check-in successful!',
            patientName: `${tokenData.first_name} ${tokenData.last_name}`,
            appointmentId: tokenData.appointment_id,
            queuePosition: queuePos[0]?.position || 1,
            checkinTime: new Date().toISOString()
        };
    },

    /**
     * Check eligibility for express check-in (returning patient)
     */
    async checkExpressEligibility(patientId, appointmentId) {
        // Check if patient has completed appointments before
        const [history] = await db.query(
            `SELECT COUNT(*) as visits, MAX(appointment_date) as last_visit
             FROM appointments
             WHERE patient_id = ? AND status = 'COMPLETED'`,
            [patientId]
        );

        const visitsCount = history[0]?.visits || 0;
        const isReturningPatient = visitsCount > 0;

        // Check if this is a follow-up appointment
        const [apt] = await db.query(
            `SELECT a.*, 
                    (SELECT COUNT(*) FROM appointments 
                     WHERE patient_id = ? AND doctor_id = a.doctor_id AND status = 'COMPLETED') as doctor_visits
             FROM appointments a
             WHERE a.id = ? AND a.patient_id = ?`,
            [patientId, appointmentId, patientId]
        );

        if (!apt.length) {
            return { eligible: false, reason: 'Appointment not found' };
        }

        const isFollowUp = apt[0].doctor_visits > 0;
        const isEligible = isReturningPatient || isFollowUp;

        return {
            eligible: isEligible,
            isReturningPatient,
            isFollowUp,
            totalVisits: visitsCount,
            doctorVisits: apt[0].doctor_visits,
            reason: isEligible 
                ? 'Eligible for express check-in'
                : 'First-time patient - standard check-in required'
        };
    },

    /**
     * One-tap check-in for eligible patients
     */
    async oneTapCheckin(appointmentId, patientId) {
        // Verify eligibility
        const eligibility = await this.checkExpressEligibility(patientId, appointmentId);
        
        if (!eligibility.eligible) {
            throw new Error(eligibility.reason);
        }

        // Verify appointment exists and is for today
        const [appointments] = await db.query(
            `SELECT * FROM appointments 
             WHERE id = ? AND patient_id = ? AND DATE(appointment_date) = CURDATE()`,
            [appointmentId, patientId]
        );

        if (!appointments.length) {
            throw new Error('No appointment found for today');
        }

        const apt = appointments[0];

        if (['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(apt.status)) {
            throw new Error('Already checked in');
        }

        // Perform check-in
        await db.query(
            `UPDATE appointments 
             SET status = 'CHECKED_IN', 
                 checked_in_at = NOW(),
                 checkin_method = 'ONE_TAP'
             WHERE id = ?`,
            [appointmentId]
        );

        // Get queue position
        const [queuePos] = await db.query(
            `SELECT COUNT(*) as position
             FROM appointments
             WHERE doctor_id = ? 
               AND DATE(appointment_date) = CURDATE()
               AND status IN ('CHECKED_IN', 'IN_PROGRESS')
               AND id != ?`,
            [apt.doctor_id, appointmentId]
        );

        return {
            success: true,
            message: 'One-tap check-in successful!',
            queuePosition: (queuePos[0]?.position || 0) + 1,
            estimatedWaitMins: ((queuePos[0]?.position || 0)) * 15
        };
    },

    /**
     * Get pre-filled patient info for express check-in
     */
    async getPrefilledInfo(patientId) {
        // Get last completed appointment details
        const [lastVisit] = await db.query(
            `SELECT a.*, d.first_name as doc_first, d.last_name as doc_last, s.name as specialty
             FROM appointments a
             JOIN users d ON a.doctor_id = d.id
             LEFT JOIN specialties s ON d.specialty_id = s.id
             WHERE a.patient_id = ? AND a.status = 'COMPLETED'
             ORDER BY a.appointment_date DESC
             LIMIT 1`,
            [patientId]
        );

        // Get patient profile
        const [patient] = await db.query(
            `SELECT first_name, last_name, email, phone, date_of_birth
             FROM users WHERE id = ?`,
            [patientId]
        );

        if (!patient.length) {
            return { hasHistory: false };
        }

        return {
            hasHistory: lastVisit.length > 0,
            patient: patient[0],
            lastVisit: lastVisit[0] ? {
                date: lastVisit[0].appointment_date,
                doctor: `Dr. ${lastVisit[0].doc_first} ${lastVisit[0].doc_last}`,
                specialty: lastVisit[0].specialty
            } : null,
            preferredDoctor: lastVisit[0] ? {
                id: lastVisit[0].doctor_id,
                name: `Dr. ${lastVisit[0].doc_first} ${lastVisit[0].doc_last}`
            } : null
        };
    },

    /**
     * Get today's appointments eligible for express check-in
     */
    async getTodayExpressEligible(patientId) {
        const [appointments] = await db.query(
            `SELECT a.*, d.first_name as doc_first, d.last_name as doc_last, s.name as specialty,
                    (SELECT COUNT(*) FROM appointments 
                     WHERE patient_id = ? AND doctor_id = a.doctor_id AND status = 'COMPLETED') as previous_visits
             FROM appointments a
             JOIN users d ON a.doctor_id = d.id
             LEFT JOIN specialties s ON d.specialty_id = s.id
             WHERE a.patient_id = ?
               AND DATE(a.appointment_date) = CURDATE()
               AND a.status IN ('CONFIRMED', 'PENDING')
             ORDER BY a.time_slot`,
            [patientId, patientId]
        );

        return appointments.map(apt => ({
            id: apt.id,
            time: apt.time_slot,
            doctor: `Dr. ${apt.doc_first} ${apt.doc_last}`,
            specialty: apt.specialty,
            isExpressEligible: apt.previous_visits > 0,
            previousVisits: apt.previous_visits
        }));
    }
};

module.exports = expressCheckinService;
