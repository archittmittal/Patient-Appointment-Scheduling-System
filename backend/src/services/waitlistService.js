/**
 * Issue #41: No-Show Auto-Fill Waitlist Service
 * Manages dynamic waitlist and automatic slot filling when cancellations/no-shows occur
 */

const pool = require('../config/db');
const notificationService = require('./notificationService');

function convertTo24Hour(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        throw new Error('Invalid time input: must be a non-empty string');
    }
    const startPart = timeStr.split(/[–\-—]/)[0].trim();
    const ampmMatch = startPart.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (ampmMatch) {
        let hours = parseInt(ampmMatch[1], 10);
        const minutes = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[3].toUpperCase();
        if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
            throw new Error(`Invalid time format: ${timeStr}`);
        }
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    }
    const simpleMatch = startPart.match(/(\d+):(\d+)/);
    if (simpleMatch) {
        const hours = parseInt(simpleMatch[1], 10);
        const minutes = parseInt(simpleMatch[2], 10);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            throw new Error(`Invalid time format: ${timeStr}`);
        }
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    }
    throw new Error(`Invalid time format: ${timeStr}`);
}

function convertTo12Hour(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        throw new Error('Invalid time input: must be a non-empty string');
    }
    const parts = timeStr.split(':');
    if (parts.length < 2) {
        throw new Error(`Invalid time format: ${timeStr}`);
    }
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error(`Invalid time format: ${timeStr}`);
    }
    const ampm = hours >= 12 ? 'PM' : 'AM';
    let displayHours = hours % 12;
    displayHours = displayHours ? displayHours : 12;
    const hoursStr = String(displayHours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    return `${hoursStr}:${minutesStr} ${ampm}`;
}

class WaitlistService {
    constructor() {
        // Ensure methods are bound to this instance
        this.joinWaitlist = this.joinWaitlist.bind(this);
        this.leaveWaitlist = this.leaveWaitlist.bind(this);
        this.getPatientWaitlist = this.getPatientWaitlist.bind(this);
        this.getDoctorWaitlist = this.getDoctorWaitlist.bind(this);
        this.handleSlotRelease = this.handleSlotRelease.bind(this);
        this.acceptSlotOffer = this.acceptSlotOffer.bind(this);
        this.declineSlotOffer = this.declineSlotOffer.bind(this);
        this.getPatientOffers = this.getPatientOffers.bind(this);
        this.updateAutoFillSettings = this.updateAutoFillSettings.bind(this);
        this.getAutoFillSettings = this.getAutoFillSettings.bind(this);
        this.cleanupExpired = this.cleanupExpired.bind(this);
        this.getAutoFillAnalytics = this.getAutoFillAnalytics.bind(this);
        this.getTimePreference = this.getTimePreference.bind(this);
    }

    /**
     * Add patient to waitlist for a specific doctor
     */
    async joinWaitlist(patientId, doctorId, options = {}) {
        const {
            preferredDate,
            timePreference = 'ANY',
            maxNoticeHours = 24,
            reason = null
        } = options;

        // Check if patient already on waitlist for this doctor/date
        const [existing] = await pool.query(
            `SELECT id FROM waitlist 
             WHERE patient_id = ? AND doctor_id = ? AND preferred_date = ? AND status = 'ACTIVE'`,
            [patientId, doctorId, preferredDate]
        );

        if (existing.length > 0) {
            return { success: false, error: 'Already on waitlist for this doctor and date' };
        }

        // Calculate expiry (end of preferred date)
        const expiresAt = new Date(preferredDate);
        expiresAt.setHours(23, 59, 59);

        const [result] = await pool.query(
            `INSERT INTO waitlist (patient_id, doctor_id, preferred_date, time_preference, max_notice_hours, reason, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [patientId, doctorId, preferredDate, timePreference, maxNoticeHours, reason, expiresAt]
        );

        return { 
            success: true, 
            waitlistId: result.insertId,
            message: 'Added to waitlist. You will be notified if a slot becomes available.'
        };
    }

    /**
     * Remove patient from waitlist
     */
    async leaveWaitlist(waitlistId, patientId) {
        const [result] = await pool.query(
            `UPDATE waitlist SET status = 'CANCELLED' 
             WHERE id = ? AND patient_id = ? AND status = 'ACTIVE'`,
            [waitlistId, patientId]
        );

        return { success: result.affectedRows > 0 };
    }

    /**
     * Get patient's active waitlist entries
     */
    async getPatientWaitlist(patientId) {
        const [entries] = await pool.query(
            `SELECT w.*, 
                    d.first_name as doctor_first_name, 
                    d.last_name as doctor_last_name,
                    (SELECT COUNT(*) FROM waitlist w2 
                     WHERE w2.doctor_id = w.doctor_id 
                     AND w2.preferred_date = w.preferred_date 
                     AND w2.status = 'ACTIVE' 
                     AND w2.created_at < w.created_at) + 1 as queue_position
             FROM waitlist w
             JOIN doctors d ON w.doctor_id = d.id
             WHERE w.patient_id = ? AND w.status IN ('ACTIVE', 'OFFERED')
             ORDER BY w.preferred_date ASC`,
            [patientId]
        );

        return entries;
    }

    /**
     * Get doctor's waitlist for management
     */
    async getDoctorWaitlist(doctorId, date = null) {
        let query = `
            SELECT w.*, 
                   p.first_name as patient_first_name,
                   p.last_name as patient_last_name,
                   u.email as patient_email,
                   u.phone as patient_phone
            FROM waitlist w
            JOIN patients p ON w.patient_id = p.id
            LEFT JOIN users u ON p.id = u.id
            WHERE w.doctor_id = ? AND w.status = 'ACTIVE'
        `;
        const params = [doctorId];

        if (date) {
            query += ` AND w.preferred_date = ?`;
            params.push(date);
        }

        query += ` ORDER BY w.created_at ASC`;

        const [entries] = await pool.query(query, params);
        return entries;
    }

    /**
     * Process a slot release (cancellation/no-show) and attempt auto-fill
     */
    async handleSlotRelease(appointmentId, releaseType) {
        // Get appointment details with doctor's name
        const result = await pool.query(
            `SELECT a.*, a.time_slot AS appointment_time, d.id as doctor_id, d.first_name, d.last_name 
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.id
             WHERE a.id = ?`,
            [appointmentId]
        );
        
        const appointment = (result && Array.isArray(result[0])) ? result[0][0] : undefined;

        if (!appointment) {
            return { success: false, error: 'Appointment not found' };
        }

        const { doctor_id, appointment_date, appointment_time } = appointment;
        const mysqlTime = convertTo24Hour(appointment_time);

        // Log the slot release
        await pool.query(
            `INSERT INTO slot_release_log (appointment_id, doctor_id, release_type, slot_date, slot_time)
             VALUES (?, ?, ?, ?, ?)`,
            [appointmentId, doctor_id, releaseType, appointment_date, mysqlTime]
        );

        // Check if auto-fill is enabled for this doctor
        const [settingsRows] = await pool.query(
            `SELECT * FROM autofill_settings WHERE doctor_id = ?`,
            [doctor_id]
        );
        const settings = settingsRows[0];

        if (!settings || !settings.enabled) {
            return { success: true, autoFillAttempted: false, reason: 'Auto-fill disabled for doctor' };
        }

        // Check if slot is too soon (minimum notice)
        let slotDateStr;
        if (appointment_date instanceof Date) {
            const y = appointment_date.getFullYear();
            const m = String(appointment_date.getMonth() + 1).padStart(2, '0');
            const d = String(appointment_date.getDate()).padStart(2, '0');
            slotDateStr = `${y}-${m}-${d}`;
        } else {
            slotDateStr = String(appointment_date).slice(0, 10);
        }
        const slotDateTime = new Date(`${slotDateStr}T${mysqlTime}`);
        const hoursUntilSlot = (slotDateTime - new Date()) / (1000 * 60 * 60);

        if (hoursUntilSlot < settings.min_notice_hours) {
            return { success: true, autoFillAttempted: false, reason: 'Slot too soon for auto-fill' };
        }

        // Find eligible waitlist patients
        const timePreferenceFilter = this.getTimePreference(mysqlTime);
        
        const [candidates] = await pool.query(
            `SELECT w.* FROM waitlist w
             WHERE w.doctor_id = ? 
             AND w.status = 'ACTIVE'
             AND w.preferred_date >= ?
             AND w.max_notice_hours <= ?
             AND (w.time_preference = 'ANY' OR w.time_preference = ?)
             ORDER BY 
                CASE 
                    WHEN w.preferred_date = ? THEN 0 
                    ELSE 1 
                END,
                w.created_at ASC
             LIMIT ?`,
            [doctor_id, appointment_date, hoursUntilSlot, timePreferenceFilter, appointment_date, settings.max_offers_per_slot]
        );

        if (candidates.length === 0) {
            await pool.query(
                `UPDATE slot_release_log SET auto_fill_attempted = TRUE WHERE appointment_id = ?`,
                [appointmentId]
            );
            return { success: true, autoFillAttempted: true, offers_sent: 0, reason: 'No eligible waitlist patients' };
        }

        // Create offers for candidates
        const offerExpiry = new Date();
        offerExpiry.setMinutes(offerExpiry.getMinutes() + settings.offer_window_mins);

        let offersSent = 0;
        for (const candidate of candidates) {
            await pool.query(
                `INSERT INTO slot_offers (waitlist_id, original_appointment_id, offered_date, offered_time, expires_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [candidate.id, appointmentId, appointment_date, mysqlTime, offerExpiry]
            );

            // Update waitlist status to OFFERED
            await pool.query(
                `UPDATE waitlist SET status = 'OFFERED' WHERE id = ?`,
                [candidate.id]
            );

            offersSent++;
            
            // Dispatch notification via preferences
            const doctorName = `${appointment.first_name} ${appointment.last_name}`;
            await notificationService.notifyWaitlistOffer(
                candidate.patient_id,
                doctorName,
                appointment_date,
                appointment_time,
                settings.offer_window_mins
            ).catch(err => console.error(`Failed to send waitlist offer notification to user ${candidate.patient_id}:`, err));
        }

        await pool.query(
            `UPDATE slot_release_log SET auto_fill_attempted = TRUE WHERE appointment_id = ?`,
            [appointmentId]
        );

        return { 
            success: true, 
            autoFillAttempted: true, 
            offers_sent: offersSent,
            offer_expires: offerExpiry
        };
    }

    /**
     * Accept a slot offer
     */
    async acceptSlotOffer(offerId, patientId) {
        let conn = null;
        try {
            conn = await pool.getConnection();
            await conn.beginTransaction();

            // Get offer and verify ownership, joining waitlist, appointments (to get original time_slot), and doctors (for capacity check)
            const [offerRows] = await conn.query(
                `SELECT so.*, w.patient_id, w.doctor_id, a.time_slot AS original_time_slot, d.max_patients_per_slot
                 FROM slot_offers so
                 JOIN waitlist w ON so.waitlist_id = w.id
                 JOIN appointments a ON so.original_appointment_id = a.id
                 JOIN doctors d ON w.doctor_id = d.id
                 WHERE so.id = ? AND w.patient_id = ?
                 FOR UPDATE`,
                [offerId, patientId]
            );
            const offer = offerRows[0];

            if (!offer) {
                await conn.rollback();
                return { success: false, error: 'Offer not found' };
            }

            if (offer.offer_status !== 'PENDING') {
                await conn.rollback();
                return { success: false, error: 'Offer is no longer available' };
            }

            if (new Date(offer.expires_at) < new Date()) {
                await conn.query(`UPDATE slot_offers SET offer_status = 'EXPIRED' WHERE id = ?`, [offerId]);
                await conn.commit();
                return { success: false, error: 'Offer has expired' };
            }

            const maxPatients = offer.max_patients_per_slot ?? 15;

            // Check if slot is still available under doctor's capacity limit, locking active appointments FOR UPDATE
            const [slotRows] = await conn.query(
                `SELECT COUNT(*) AS slot_count 
                 FROM appointments 
                 WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'CANCELLED'
                 FOR UPDATE`,
                [offer.doctor_id, offer.offered_date, offer.original_time_slot]
            );
            const activeCount = slotRows[0].slot_count;

            if (activeCount >= maxPatients) {
                await conn.query(`UPDATE slot_offers SET offer_status = 'EXPIRED' WHERE id = ?`, [offerId]);
                await conn.commit();
                return { success: false, error: 'Slot has already been filled' };
            }

            // Create new appointment
            const [newAppointment] = await conn.query(
                `INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, status, symptoms)
                 VALUES (?, ?, ?, ?, 'SCHEDULED', 'Waitlist auto-fill')`,
                [patientId, offer.doctor_id, offer.offered_date, offer.original_time_slot]
            );

            // Update offer status
            await conn.query(
                `UPDATE slot_offers 
                 SET offer_status = 'ACCEPTED', responded_at = NOW(), new_appointment_id = ?
                 WHERE id = ?`,
                [newAppointment.insertId, offerId]
            );

            // Update waitlist entry
            await conn.query(
                `UPDATE waitlist SET status = 'ACCEPTED' WHERE id = ?`,
                [offer.waitlist_id]
            );

            // Expire other offers for same slot
            await conn.query(
                `UPDATE slot_offers 
                 SET offer_status = 'EXPIRED' 
                 WHERE original_appointment_id = ? AND id != ? AND offer_status = 'PENDING'`,
                [offer.original_appointment_id, offerId]
            );

            // Update slot release log
            await conn.query(
                `UPDATE slot_release_log 
                 SET auto_fill_successful = TRUE, filled_by_patient_id = ?
                 WHERE appointment_id = ?`,
                [patientId, offer.original_appointment_id]
            );

            // Restore waitlist status for patients whose offers expired
            await conn.query(
                `UPDATE waitlist w
                 JOIN slot_offers so ON w.id = so.waitlist_id
                 SET w.status = 'ACTIVE'
                 WHERE so.original_appointment_id = ? AND so.id != ? AND so.offer_status = 'EXPIRED'`,
                [offer.original_appointment_id, offerId]
            );

            await conn.commit();

            return { 
                success: true, 
                appointmentId: newAppointment.insertId,
                message: 'Slot successfully booked!'
            };
        } catch (error) {
            if (conn) {
                try {
                    await conn.rollback();
                } catch (rollbackError) {
                    console.error('Rollback failed:', rollbackError);
                }
            }
            console.error('acceptSlotOffer error:', error);
            return { success: false, error: 'Server error accepting slot offer' };
        } finally {
            if (conn) {
                conn.release();
            }
        }
    }

    /**
     * Decline a slot offer
     */
    async declineSlotOffer(offerId, patientId) {
        const [declineOfferRows] = await pool.query(
            `SELECT so.*, w.patient_id
             FROM slot_offers so
             JOIN waitlist w ON so.waitlist_id = w.id
             WHERE so.id = ? AND w.patient_id = ?`,
            [offerId, patientId]
        );
        const offer = declineOfferRows[0];

        if (!offer) {
            return { success: false, error: 'Offer not found' };
        }

        await pool.query(
            `UPDATE slot_offers SET offer_status = 'DECLINED', responded_at = NOW() WHERE id = ?`,
            [offerId]
        );

        // Return patient to active waitlist
        await pool.query(
            `UPDATE waitlist SET status = 'ACTIVE' WHERE id = ?`,
            [offer.waitlist_id]
        );

        return { success: true };
    }

    /**
     * Get pending offers for a patient
     */
    async getPatientOffers(patientId) {
        const [offers] = await pool.query(
            `SELECT so.*, 
                    d.specialty,
                    d.first_name as doctor_first_name,
                    d.last_name as doctor_last_name,
                    TIMESTAMPDIFF(MINUTE, NOW(), so.expires_at) as minutes_remaining
             FROM slot_offers so
             JOIN waitlist w ON so.waitlist_id = w.id
             JOIN doctors d ON w.doctor_id = d.id
             LEFT JOIN users u ON d.id = u.id
             WHERE w.patient_id = ? AND so.offer_status = 'PENDING' AND so.expires_at > NOW()
             ORDER BY so.expires_at ASC`,
            [patientId]
        );

        return offers;
    }

    /**
     * Update doctor's auto-fill settings
     */
    async updateAutoFillSettings(doctorId, settings) {
        const {
            enabled,
            offerWindowMins,
            minNoticeHours,
            maxOffersPerSlot,
            priorityMode
        } = settings;

        await pool.query(
            `INSERT INTO autofill_settings (doctor_id, enabled, offer_window_mins, min_notice_hours, max_offers_per_slot, priority_mode)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                enabled = VALUES(enabled),
                offer_window_mins = VALUES(offer_window_mins),
                min_notice_hours = VALUES(min_notice_hours),
                max_offers_per_slot = VALUES(max_offers_per_slot),
                priority_mode = VALUES(priority_mode)`,
            [doctorId, enabled, offerWindowMins, minNoticeHours, maxOffersPerSlot, priorityMode]
        );

        return { success: true };
    }

    /**
     * Get doctor's auto-fill settings
     */
    async getAutoFillSettings(doctorId) {
        const [autoFillRows] = await pool.query(
            `SELECT * FROM autofill_settings WHERE doctor_id = ?`,
            [doctorId]
        );
        const settings = autoFillRows[0];

        return settings || {
            doctor_id: doctorId,
            enabled: true,
            offer_window_mins: 30,
            min_notice_hours: 2,
            max_offers_per_slot: 3,
            priority_mode: 'FIFO'
        };
    }

    /**
     * Clean up expired waitlist entries and offers
     */
    async cleanupExpired() {
        // Expire old waitlist entries
        await pool.query(
            `UPDATE waitlist SET status = 'EXPIRED' 
             WHERE status = 'ACTIVE' AND expires_at < NOW()`
        );

        // Expire old offers and restore waitlist status
        const [expiredOffers] = await pool.query(
            `SELECT id, waitlist_id FROM slot_offers 
             WHERE offer_status = 'PENDING' AND expires_at < NOW()`
        );

        for (const offer of expiredOffers) {
            await pool.query(`UPDATE slot_offers SET offer_status = 'EXPIRED' WHERE id = ?`, [offer.id]);
            await pool.query(`UPDATE waitlist SET status = 'ACTIVE' WHERE id = ? AND status = 'OFFERED'`, [offer.waitlist_id]);
        }

        return { cleaned: expiredOffers.length };
    }

    /**
     * Get analytics for auto-fill system
     */
    async getAutoFillAnalytics(doctorId, startDate, endDate) {
        const [stats] = await pool.query(
            `SELECT 
                COUNT(*) as total_releases,
                SUM(CASE WHEN release_type = 'CANCELLATION' THEN 1 ELSE 0 END) as cancellations,
                SUM(CASE WHEN release_type = 'NO_SHOW' THEN 1 ELSE 0 END) as no_shows,
                SUM(CASE WHEN auto_fill_attempted THEN 1 ELSE 0 END) as auto_fill_attempts,
                SUM(CASE WHEN auto_fill_successful THEN 1 ELSE 0 END) as successful_fills,
                ROUND(SUM(CASE WHEN auto_fill_successful THEN 1 ELSE 0 END) * 100.0 / 
                      NULLIF(SUM(CASE WHEN auto_fill_attempted THEN 1 ELSE 0 END), 0), 1) as fill_rate
             FROM slot_release_log
             WHERE doctor_id = ? AND slot_date BETWEEN ? AND ?`,
            [doctorId, startDate, endDate]
        );

        return stats[0];
    }

    // Helper function to determine time preference from time
    getTimePreference(timeStr) {
        const hour = parseInt(timeStr.split(':')[0]);
        if (hour < 12) return 'MORNING';
        if (hour < 17) return 'AFTERNOON';
        return 'EVENING';
    }
}

module.exports = new WaitlistService();
