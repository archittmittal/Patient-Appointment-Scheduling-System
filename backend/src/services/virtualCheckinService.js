/**
 * Issue #39: Virtual Waiting Room Service
 * Enables patients to check-in remotely and join the virtual queue
 */

const db = require('../config/db');

const virtualCheckinService = {
    /**
     * Virtual check-in for an appointment (patient joins queue from home)
     */
    async virtualCheckIn(appointmentId, patientId, options = {}) {
        const { etaMinutes, latitude, longitude, device } = options;
        
        // Verify appointment belongs to patient and is for today
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

        const appointment = appointments[0];
        const today = new Date().toISOString().split('T')[0];
        const aptDate = new Date(appointment.appointment_date).toISOString().split('T')[0];

        if (aptDate !== today) {
            throw new Error('Virtual check-in is only available on the appointment day');
        }

        if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)) {
            throw new Error(`Cannot check-in for ${appointment.status.toLowerCase()} appointment`);
        }

        // Update appointment with virtual check-in
        await db.query(
            `UPDATE appointments SET 
                virtual_checkin_time = NOW(),
                virtual_checkin_status = 'CHECKED_IN',
                patient_eta_minutes = ?,
                patient_location_lat = ?,
                patient_location_lng = ?,
                checkin_device = ?
             WHERE id = ?`,
            [etaMinutes || null, latitude || null, longitude || null, device || 'web', appointmentId]
        );

        // Create virtual waiting session
        const [sessionResult] = await db.query(
            `INSERT INTO virtual_waiting_sessions 
                (appointment_id, patient_id, estimated_call_time) 
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
            [appointmentId, patientId, etaMinutes || 30]
        );

        // Create notification for clinic staff
        await db.query(
            `INSERT INTO checkin_notifications 
                (appointment_id, notification_type, message)
             VALUES (?, 'VIRTUAL_CHECKIN', ?)`,
            [appointmentId, `${appointment.first_name} ${appointment.last_name} has checked in virtually. ETA: ${etaMinutes || 'Not specified'} minutes`]
        );

        return {
            success: true,
            message: 'Virtual check-in successful! You are now in the virtual waiting room.',
            sessionId: sessionResult.insertId,
            checkinTime: new Date().toISOString(),
            estimatedCallTime: etaMinutes ? new Date(Date.now() + etaMinutes * 60000).toISOString() : null
        };
    },

    /**
     * Update patient status (en route, arrived, running late)
     */
    async updateStatus(appointmentId, patientId, status, options = {}) {
        const { etaMinutes, message } = options;
        const validStatuses = ['EN_ROUTE', 'ARRIVED', 'RUNNING_LATE'];
        
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid status');
        }

        // Verify appointment
        const [appointments] = await db.query(
            `SELECT * FROM appointments WHERE id = ? AND patient_id = ?`,
            [appointmentId, patientId]
        );

        if (!appointments.length) {
            throw new Error('Appointment not found or unauthorized');
        }

        // Map RUNNING_LATE to EN_ROUTE for DB but create special notification
        const dbStatus = status === 'RUNNING_LATE' ? 'EN_ROUTE' : status;

        // Update appointment status
        await db.query(
            `UPDATE appointments SET 
                virtual_checkin_status = ?,
                patient_eta_minutes = COALESCE(?, patient_eta_minutes)
             WHERE id = ?`,
            [dbStatus, etaMinutes, appointmentId]
        );

        // Create notification
        const notificationMessages = {
            EN_ROUTE: 'Patient is on their way to the clinic',
            ARRIVED: 'Patient has arrived at the clinic',
            RUNNING_LATE: `Patient is running late. ${message || `ETA: ${etaMinutes || 'Unknown'} minutes`}`
        };

        await db.query(
            `INSERT INTO checkin_notifications 
                (appointment_id, notification_type, message)
             VALUES (?, ?, ?)`,
            [appointmentId, status, notificationMessages[status]]
        );

        // If arrived, update session
        if (status === 'ARRIVED') {
            await db.query(
                `UPDATE virtual_waiting_sessions 
                 SET status = 'COMPLETED', session_end = NOW()
                 WHERE appointment_id = ? AND status = 'ACTIVE'`,
                [appointmentId]
            );
        }

        return {
            success: true,
            status: dbStatus,
            message: `Status updated to ${status.toLowerCase().replace('_', ' ')}`
        };
    },

    /**
     * Get virtual waiting room status for a patient
     */
    async getWaitingRoomStatus(appointmentId, patientId) {
        const [appointments] = await db.query(
            `SELECT a.*, 
                    u.first_name, u.last_name,
                    d.first_name as doc_first, d.last_name as doc_last,
                    s.name as specialty
             FROM appointments a
             JOIN users u ON a.patient_id = u.id
             JOIN users d ON a.doctor_id = d.id
             LEFT JOIN specialties s ON d.specialty_id = s.id
             WHERE a.id = ? AND a.patient_id = ?`,
            [appointmentId, patientId]
        );

        if (!appointments.length) {
            return null;
        }

        const appointment = appointments[0];

        // Get queue position
        const [queuePosition] = await db.query(
            `SELECT COUNT(*) + 1 as position
             FROM appointments 
             WHERE doctor_id = ? 
               AND appointment_date = ?
               AND status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
               AND (time_slot < ? OR (time_slot = ? AND id < ?))`,
            [appointment.doctor_id, appointment.appointment_date, 
             appointment.time_slot, appointment.time_slot, appointmentId]
        );

        // Get virtual session info
        const [sessions] = await db.query(
            `SELECT * FROM virtual_waiting_sessions 
             WHERE appointment_id = ? 
             ORDER BY created_at DESC LIMIT 1`,
            [appointmentId]
        );

        // Calculate estimated wait
        const avgConsultTime = 15; // minutes
        const position = queuePosition[0]?.position || 0;
        const estimatedWaitMins = Math.max(0, (position - 1) * avgConsultTime);

        return {
            appointment: {
                id: appointment.id,
                date: appointment.appointment_date,
                time: appointment.time_slot,
                doctor: `Dr. ${appointment.doc_first} ${appointment.doc_last}`,
                specialty: appointment.specialty,
                status: appointment.status,
                virtualCheckinStatus: appointment.virtual_checkin_status,
                checkinTime: appointment.virtual_checkin_time
            },
            queue: {
                position,
                estimatedWaitMins,
                estimatedCallTime: new Date(Date.now() + estimatedWaitMins * 60000).toISOString()
            },
            session: sessions[0] || null,
            isCheckedIn: appointment.virtual_checkin_status !== 'NOT_CHECKED_IN'
        };
    },

    /**
     * Get all virtually checked-in patients for a doctor (for clinic view)
     */
    async getVirtualQueueForDoctor(doctorId) {
        const today = new Date().toISOString().split('T')[0];

        const [patients] = await db.query(
            `SELECT a.id, a.time_slot, a.status, a.virtual_checkin_status,
                    a.virtual_checkin_time, a.patient_eta_minutes,
                    u.first_name, u.last_name, u.phone,
                    s.session_start, s.last_ping
             FROM appointments a
             JOIN users u ON a.patient_id = u.id
             LEFT JOIN virtual_waiting_sessions s ON a.id = s.appointment_id AND s.status = 'ACTIVE'
             WHERE a.doctor_id = ?
               AND DATE(a.appointment_date) = ?
               AND a.virtual_checkin_status != 'NOT_CHECKED_IN'
             ORDER BY a.time_slot, a.virtual_checkin_time`,
            [doctorId, today]
        );

        return patients.map((p, index) => ({
            ...p,
            queuePosition: index + 1,
            patientName: `${p.first_name} ${p.last_name}`,
            waitingTime: p.virtual_checkin_time 
                ? Math.round((Date.now() - new Date(p.virtual_checkin_time).getTime()) / 60000)
                : 0
        }));
    },

    /**
     * Keep session alive (heartbeat from patient app)
     */
    async pingSession(appointmentId, patientId) {
        await db.query(
            `UPDATE virtual_waiting_sessions 
             SET last_ping = NOW()
             WHERE appointment_id = ? AND status = 'ACTIVE'`,
            [appointmentId]
        );

        return { success: true, timestamp: new Date().toISOString() };
    },

    /**
     * Cancel virtual check-in
     */
    async cancelCheckin(appointmentId, patientId) {
        await db.query(
            `UPDATE appointments SET 
                virtual_checkin_status = 'NOT_CHECKED_IN',
                virtual_checkin_time = NULL,
                patient_eta_minutes = NULL
             WHERE id = ? AND patient_id = ?`,
            [appointmentId, patientId]
        );

        await db.query(
            `UPDATE virtual_waiting_sessions 
             SET status = 'CANCELLED', session_end = NOW()
             WHERE appointment_id = ? AND status = 'ACTIVE'`,
            [appointmentId]
        );

        await db.query(
            `INSERT INTO checkin_notifications 
                (appointment_id, notification_type, message)
             VALUES (?, 'CANCELLED', 'Patient has cancelled their virtual check-in')`,
            [appointmentId]
        );

        return { success: true, message: 'Virtual check-in cancelled' };
    },

    /**
     * Get pending check-in notifications for staff
     */
    async getPendingNotifications(doctorId = null) {
        let query = `
            SELECT cn.*, a.time_slot, a.doctor_id,
                   u.first_name, u.last_name,
                   d.first_name as doc_first, d.last_name as doc_last
            FROM checkin_notifications cn
            JOIN appointments a ON cn.appointment_id = a.id
            JOIN users u ON a.patient_id = u.id
            JOIN users d ON a.doctor_id = d.id
            WHERE cn.acknowledged = FALSE
              AND DATE(a.appointment_date) = CURDATE()`;

        const params = [];
        if (doctorId) {
            query += ` AND a.doctor_id = ?`;
            params.push(doctorId);
        }

        query += ` ORDER BY cn.created_at DESC`;

        const [notifications] = await db.query(query, params);
        return notifications;
    },

    /**
     * Acknowledge a notification
     */
    async acknowledgeNotification(notificationId, userId) {
        await db.query(
            `UPDATE checkin_notifications 
             SET acknowledged = TRUE, acknowledged_by = ?, acknowledged_at = NOW()
             WHERE id = ?`,
            [userId, notificationId]
        );

        return { success: true };
    }
};

module.exports = virtualCheckinService;
