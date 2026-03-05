/**
 * Issue #42: Walk-in Priority Service
 * Manages walk-in patient queue with urgency-based prioritization
 */

const db = require('../config/db');

const walkinPriorityService = {
    /**
     * Register a new walk-in patient
     */
    async registerWalkin(patientId, data) {
        const { 
            doctorId, 
            specialtyId, 
            urgencyLevel = 'NORMAL', 
            reason, 
            symptoms,
            vitalSigns 
        } = data;

        // Calculate triage score based on urgency and wait time factors
        const triageScore = await this.calculateTriageScore(urgencyLevel, vitalSigns);

        // Find queue position based on priority
        const queuePosition = await this.determineQueuePosition(doctorId, specialtyId, triageScore);

        // Insert into walk-in queue
        const [result] = await db.query(
            `INSERT INTO walkin_queue 
                (patient_id, doctor_id, specialty_id, urgency_level, reason, symptoms, vital_signs, triage_score, queue_position)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [patientId, doctorId, specialtyId, urgencyLevel, reason, symptoms, 
             JSON.stringify(vitalSigns || {}), triageScore, queuePosition]
        );

        // Reorder queue to accommodate new patient based on priority
        await this.reorderQueue(doctorId, specialtyId);

        // Get estimated wait time
        const waitTime = await this.estimateWaitTime(result.insertId);

        return {
            success: true,
            walkinId: result.insertId,
            queuePosition,
            triageScore,
            estimatedWaitMinutes: waitTime,
            message: this.getWaitMessage(urgencyLevel, waitTime)
        };
    },

    /**
     * Calculate triage score based on multiple factors
     */
    async calculateTriageScore(urgencyLevel, vitalSigns = {}) {
        // Base score from urgency configuration
        const [config] = await db.query(
            `SELECT priority_weight FROM urgency_config WHERE urgency_level = ?`,
            [urgencyLevel]
        );

        let baseScore = (config[0]?.priority_weight || 2) * 20; // 20-200 range

        // Adjust based on vital signs if available
        if (vitalSigns) {
            // High blood pressure
            if (vitalSigns.bp_systolic > 160 || vitalSigns.bp_diastolic > 100) {
                baseScore += 15;
            }
            // Fever
            if (vitalSigns.temperature > 39) {
                baseScore += 10;
            } else if (vitalSigns.temperature > 38) {
                baseScore += 5;
            }
            // Low oxygen
            if (vitalSigns.oxygen_saturation && vitalSigns.oxygen_saturation < 94) {
                baseScore += 20;
            }
            // High heart rate
            if (vitalSigns.heart_rate > 100) {
                baseScore += 10;
            }
        }

        return Math.min(baseScore, 200); // Cap at 200
    },

    /**
     * Determine initial queue position
     */
    async determineQueuePosition(doctorId, specialtyId, triageScore) {
        // Get current queue for the doctor/specialty
        let query = `SELECT id, triage_score, queue_position FROM walkin_queue WHERE status = 'WAITING'`;
        const params = [];

        if (doctorId) {
            query += ` AND doctor_id = ?`;
            params.push(doctorId);
        } else if (specialtyId) {
            query += ` AND specialty_id = ?`;
            params.push(specialtyId);
        }

        query += ` ORDER BY triage_score DESC, registered_at ASC`;

        const [queue] = await db.query(query, params);

        // Find position where new patient should be inserted
        let position = 1;
        for (const item of queue) {
            if (triageScore > item.triage_score) {
                break;
            }
            position++;
        }

        return position;
    },

    /**
     * Reorder queue based on priority scores
     */
    async reorderQueue(doctorId, specialtyId) {
        let whereClause = `status = 'WAITING'`;
        const params = [];

        if (doctorId) {
            whereClause += ` AND doctor_id = ?`;
            params.push(doctorId);
        } else if (specialtyId) {
            whereClause += ` AND specialty_id = ?`;
            params.push(specialtyId);
        }

        // Get all waiting walk-ins sorted by priority
        const [queue] = await db.query(
            `SELECT id, registered_at, TIMESTAMPDIFF(MINUTE, registered_at, NOW()) as wait_mins, triage_score
             FROM walkin_queue 
             WHERE ${whereClause}
             ORDER BY triage_score DESC, registered_at ASC`,
            params
        );

        // Update positions - also boost priority for long waits
        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            let adjustedScore = item.triage_score;
            
            // Boost priority for longer waits (prevents starvation)
            if (item.wait_mins > 30) {
                adjustedScore += Math.floor(item.wait_mins / 15) * 5;
            }

            await db.query(
                `UPDATE walkin_queue SET queue_position = ?, triage_score = ? WHERE id = ?`,
                [i + 1, Math.min(adjustedScore, 200), item.id]
            );
        }
    },

    /**
     * Estimate wait time for a walk-in patient
     */
    async estimateWaitTime(walkinId) {
        const [walkin] = await db.query(
            `SELECT * FROM walkin_queue WHERE id = ?`,
            [walkinId]
        );

        if (!walkin.length) return 60;

        const patient = walkin[0];
        const avgConsultTime = 15; // minutes per patient

        // Count patients ahead in queue
        let patientsAhead = patient.queue_position - 1;

        // Also count scheduled patients
        if (patient.doctor_id) {
            const [scheduled] = await db.query(
                `SELECT COUNT(*) as count FROM appointments 
                 WHERE doctor_id = ? 
                   AND DATE(appointment_date) = CURDATE()
                   AND status IN ('CONFIRMED', 'CHECKED_IN')
                   AND time_slot <= ADDTIME(CURTIME(), '01:00:00')`,
                [patient.doctor_id]
            );
            patientsAhead += scheduled[0]?.count || 0;
        }

        return Math.max(5, patientsAhead * avgConsultTime);
    },

    /**
     * Get next walk-in patient to be called
     */
    async getNextWalkin(doctorId) {
        const [next] = await db.query(
            `SELECT wq.*, u.first_name, u.last_name, u.phone
             FROM walkin_queue wq
             JOIN users u ON wq.patient_id = u.id
             WHERE wq.doctor_id = ? AND wq.status = 'WAITING'
             ORDER BY wq.queue_position ASC
             LIMIT 1`,
            [doctorId]
        );

        return next[0] || null;
    },

    /**
     * Get all walk-ins waiting for a doctor
     */
    async getWalkinQueue(doctorId) {
        const [queue] = await db.query(
            `SELECT wq.*, u.first_name, u.last_name, u.phone,
                    TIMESTAMPDIFF(MINUTE, wq.registered_at, NOW()) as wait_minutes
             FROM walkin_queue wq
             JOIN users u ON wq.patient_id = u.id
             WHERE wq.doctor_id = ? AND wq.status = 'WAITING'
             ORDER BY wq.queue_position ASC`,
            [doctorId]
        );

        return queue.map(w => ({
            ...w,
            patientName: `${w.first_name} ${w.last_name}`,
            urgencyColor: this.getUrgencyColor(w.urgency_level)
        }));
    },

    /**
     * Call/assign a walk-in patient
     */
    async callWalkin(walkinId, doctorId) {
        // Get walk-in details
        const [walkin] = await db.query(
            `SELECT * FROM walkin_queue WHERE id = ?`,
            [walkinId]
        );

        if (!walkin.length || walkin[0].status !== 'WAITING') {
            throw new Error('Walk-in not found or already processed');
        }

        const patient = walkin[0];

        // Create an appointment for tracking
        const [aptResult] = await db.query(
            `INSERT INTO appointments 
                (patient_id, doctor_id, appointment_date, time_slot, status, is_walkin, walkin_urgency, walkin_reason, walkin_registered_at)
             VALUES (?, ?, CURDATE(), CURTIME(), 'IN_PROGRESS', TRUE, ?, ?, ?)`,
            [patient.patient_id, doctorId, patient.urgency_level, patient.reason, patient.registered_at]
        );

        // Update walk-in status
        await db.query(
            `UPDATE walkin_queue 
             SET status = 'IN_CONSULTATION', doctor_id = ?, assigned_appointment_id = ?, called_at = NOW()
             WHERE id = ?`,
            [doctorId, aptResult.insertId, walkinId]
        );

        // Reorder remaining queue
        await this.reorderQueue(doctorId, null);

        return {
            success: true,
            appointmentId: aptResult.insertId,
            message: 'Patient called successfully'
        };
    },

    /**
     * Complete a walk-in consultation
     */
    async completeWalkin(walkinId) {
        const [walkin] = await db.query(
            `SELECT * FROM walkin_queue WHERE id = ?`,
            [walkinId]
        );

        if (!walkin.length) {
            throw new Error('Walk-in not found');
        }

        // Update walk-in queue
        await db.query(
            `UPDATE walkin_queue SET status = 'COMPLETED', completed_at = NOW() WHERE id = ?`,
            [walkinId]
        );

        // Update associated appointment
        if (walkin[0].assigned_appointment_id) {
            await db.query(
                `UPDATE appointments SET status = 'COMPLETED' WHERE id = ?`,
                [walkin[0].assigned_appointment_id]
            );
        }

        return { success: true };
    },

    /**
     * Update walk-in urgency (escalate/de-escalate)
     */
    async updateUrgency(walkinId, newUrgency, reason) {
        const triageScore = await this.calculateTriageScore(newUrgency, {});

        await db.query(
            `UPDATE walkin_queue 
             SET urgency_level = ?, triage_score = ?, notes = CONCAT(IFNULL(notes, ''), '\n', ?)
             WHERE id = ?`,
            [newUrgency, triageScore, `Urgency updated to ${newUrgency}: ${reason}`, walkinId]
        );

        // Reorder queue
        const [walkin] = await db.query(`SELECT doctor_id, specialty_id FROM walkin_queue WHERE id = ?`, [walkinId]);
        if (walkin[0]) {
            await this.reorderQueue(walkin[0].doctor_id, walkin[0].specialty_id);
        }

        return { success: true, newTriageScore: triageScore };
    },

    /**
     * Get walk-in statistics for dashboard
     */
    async getWalkinStats(doctorId = null) {
        let whereClause = `DATE(registered_at) = CURDATE()`;
        const params = [];

        if (doctorId) {
            whereClause += ` AND doctor_id = ?`;
            params.push(doctorId);
        }

        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total_today,
                SUM(CASE WHEN status = 'WAITING' THEN 1 ELSE 0 END) as waiting,
                SUM(CASE WHEN status = 'IN_CONSULTATION' THEN 1 ELSE 0 END) as in_consultation,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                AVG(CASE WHEN status = 'COMPLETED' THEN TIMESTAMPDIFF(MINUTE, registered_at, completed_at) END) as avg_wait_completed,
                AVG(CASE WHEN status = 'WAITING' THEN TIMESTAMPDIFF(MINUTE, registered_at, NOW()) END) as avg_current_wait,
                SUM(CASE WHEN urgency_level IN ('URGENT', 'EMERGENCY') THEN 1 ELSE 0 END) as urgent_count
            FROM walkin_queue
            WHERE ${whereClause}
        `, params);

        // Get by urgency breakdown
        const [urgencyBreakdown] = await db.query(`
            SELECT urgency_level, COUNT(*) as count
            FROM walkin_queue
            WHERE ${whereClause}
            GROUP BY urgency_level
        `, params);

        return {
            ...stats[0],
            avgWaitCompleted: Math.round(stats[0]?.avg_wait_completed || 0),
            avgCurrentWait: Math.round(stats[0]?.avg_current_wait || 0),
            urgencyBreakdown
        };
    },

    /**
     * Cancel/remove a walk-in from queue
     */
    async cancelWalkin(walkinId, reason) {
        const [walkin] = await db.query(`SELECT doctor_id, specialty_id FROM walkin_queue WHERE id = ?`, [walkinId]);

        await db.query(
            `UPDATE walkin_queue SET status = 'LEFT', notes = CONCAT(IFNULL(notes, ''), '\nCancelled: ', ?) WHERE id = ?`,
            [reason || 'Patient left', walkinId]
        );

        // Reorder remaining queue
        if (walkin[0]) {
            await this.reorderQueue(walkin[0].doctor_id, walkin[0].specialty_id);
        }

        return { success: true };
    },

    // Helper methods
    getUrgencyColor(level) {
        const colors = {
            LOW: 'bg-gray-100 text-gray-700',
            NORMAL: 'bg-blue-100 text-blue-700',
            HIGH: 'bg-orange-100 text-orange-700',
            URGENT: 'bg-red-100 text-red-700',
            EMERGENCY: 'bg-red-500 text-white'
        };
        return colors[level] || colors.NORMAL;
    },

    getWaitMessage(urgency, waitMins) {
        if (urgency === 'EMERGENCY') {
            return 'You will be seen immediately. Please proceed to the emergency area.';
        }
        if (urgency === 'URGENT') {
            return `Priority patient. Estimated wait: ${waitMins} minutes.`;
        }
        if (waitMins <= 15) {
            return `Short wait expected! Approximately ${waitMins} minutes.`;
        }
        if (waitMins <= 30) {
            return `Moderate wait time. Approximately ${waitMins} minutes.`;
        }
        return `Current wait time is approximately ${waitMins} minutes. We'll call you when it's your turn.`;
    }
};

module.exports = walkinPriorityService;
