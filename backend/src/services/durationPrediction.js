/**
 * Consultation Duration Prediction Service
 * Issue #48: AI-Powered Consultation Duration Prediction
 * 
 * Uses multiple factors to predict consultation duration:
 * 1. Doctor's historical average
 * 2. Symptom complexity analysis
 * 3. Patient type (new vs follow-up)
 * 4. Time of day patterns
 * 5. Day of week patterns
 */

const db = require('../config/db');
const logger = require('../config/logger');

class DurationPredictionService {
    constructor() {
        this.DEFAULT_DURATION = 15;
        this.MIN_DURATION = 5;
        this.MAX_DURATION = 60;

        // Ensure methods are bound to this instance
        this.predictConsultationDuration = this.predictConsultationDuration.bind(this);
        this.recordConsultationDuration = this.recordConsultationDuration.bind(this);
        this.calculateQueueWaitTime = this.calculateQueueWaitTime.bind(this);
        this.recalculateQueueEstimates = this.recalculateQueueEstimates.bind(this);
        this.extractKeywords = this.extractKeywords.bind(this);
        this.calculateSymptomComplexity = this.calculateSymptomComplexity.bind(this);
        this.getDoctorAverages = this.getDoctorAverages.bind(this);
        this.isFollowUpPatient = this.isFollowUpPatient.bind(this);
        this.getTimeAdjustment = this.getTimeAdjustment.bind(this);
    }

    /**
     * Extract keywords from symptoms text
     */
    extractKeywords(symptomsText) {
        if (!symptomsText) return [];
        
        return symptomsText
            .toLowerCase()
            .replace(/[^a-z\s-]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2)
            .filter((word, index, self) => self.indexOf(word) === index); // unique
    }

    /**
     * Calculate symptom complexity score based on keywords
     */
    async calculateSymptomComplexity(symptomsText) {
        const keywords = this.extractKeywords(symptomsText);
        
        if (keywords.length === 0) {
            return { score: 1.0, extraMins: 0 };
        }

        try {
            const placeholders = keywords.map(() => '?').join(',');
            const [rows] = await db.query(
                `SELECT keyword, complexity_score, avg_extra_mins 
                 FROM symptom_complexity 
                 WHERE keyword IN (${placeholders})`,
                keywords
            );

            if (rows.length === 0) {
                return { score: 1.0, extraMins: 0 };
            }

            const totalScore = rows.reduce((sum, r) => sum + parseFloat(r.complexity_score), 0);
            const totalExtraMins = rows.reduce((sum, r) => sum + r.avg_extra_mins, 0);
            
            return {
                score: totalScore / rows.length,
                extraMins: Math.round(totalExtraMins / rows.length)
            };
        } catch (error) {
            logger.error('Error calculating symptom complexity:', error);
            return { score: 1.0, extraMins: 0 };
        }
    }

    /**
     * Get doctor's average consultation times
     */
    async getDoctorAverages(doctorId) {
        try {
            const [rowRows] = await db.query(
                `SELECT avg_duration_mins, avg_new_patient_mins, avg_follow_up_mins, total_consultations
                 FROM doctor_avg_times WHERE doctor_id = ?`,
                [doctorId]
            );
            const row = rowRows[0];

            if (row && row.total_consultations > 0) {
                return {
                    avgDuration: parseFloat(row.avg_duration_mins),
                    avgNewPatient: parseFloat(row.avg_new_patient_mins),
                    avgFollowUp: parseFloat(row.avg_follow_up_mins),
                    sampleSize: row.total_consultations
                };
            }

            const [specialtyAvgRows] = await db.query(
                `SELECT AVG(ch.actual_duration_mins) as avg_duration
                 FROM consultation_history ch
                 JOIN doctors d ON ch.doctor_id = d.id
                 WHERE d.specialty = (SELECT specialty FROM doctors WHERE id = ?)
                 AND ch.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`,
                [doctorId]
            );
            const specialtyAvg = specialtyAvgRows[0];

            return {
                avgDuration: specialtyAvg?.avg_duration || this.DEFAULT_DURATION,
                avgNewPatient: this.DEFAULT_DURATION + 5,
                avgFollowUp: this.DEFAULT_DURATION - 3,
                sampleSize: 0
            };
        } catch (error) {
            logger.error('Error getting doctor averages:', error);
            return {
                avgDuration: this.DEFAULT_DURATION,
                avgNewPatient: this.DEFAULT_DURATION + 5,
                avgFollowUp: this.DEFAULT_DURATION - 3,
                sampleSize: 0
            };
        }
    }

    /**
     * Check if patient has visited this doctor before
     */
    async isFollowUpPatient(patientId, doctorId) {
        try {
            const [resultRows] = await db.query(
                `SELECT COUNT(*) as visits FROM appointments 
                 WHERE patient_id = ? AND doctor_id = ? AND status = 'COMPLETED'`,
                [patientId, doctorId]
            );
            const result = resultRows[0];
            return result.visits > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get time-based adjustment factor
     */
    getTimeAdjustment(timeSlot) {
        if (!timeSlot) return 0;
        
        const hourMatch = timeSlot.match(/(\d{1,2})/);
        if (!hourMatch) return 0;
        
        let hour = parseInt(hourMatch[1]);
        if (timeSlot.toLowerCase().includes('pm') && hour !== 12) {
            hour += 12;
        }
        if (timeSlot.toLowerCase().includes('am') && hour === 12) {
            hour = 0;
        }

        if (hour < 10) return 2;
        if (hour >= 16) return 3;
        if (hour >= 10 && hour <= 13) return -1;
        
        return 0;
    }

    /**
     * Main prediction function
     */
    async predictConsultationDuration({
        doctorId,
        patientId,
        symptoms,
        timeSlot,
        isFollowUp = null
    }) {
        try {
            const doctorAvg = await this.getDoctorAverages(doctorId);
            const followUp = isFollowUp !== null ? isFollowUp : await this.isFollowUpPatient(patientId, doctorId);
            let baseDuration = followUp ? doctorAvg.avgFollowUp : doctorAvg.avgNewPatient;
            const complexity = await this.calculateSymptomComplexity(symptoms);
            const timeAdj = this.getTimeAdjustment(timeSlot);
            
            let predicted = (baseDuration * complexity.score) + complexity.extraMins + timeAdj;
            
            if (doctorAvg.sampleSize < 10) {
                const confidence = doctorAvg.sampleSize / 10;
                predicted = (predicted * confidence) + (this.DEFAULT_DURATION * (1 - confidence));
            }
            
            predicted = Math.round(Math.max(this.MIN_DURATION, Math.min(this.MAX_DURATION, predicted)));
            
            return {
                predictedDuration: predicted,
                factors: {
                    baseDuration: Math.round(baseDuration),
                    complexityScore: complexity.score.toFixed(2),
                    complexityExtraMins: complexity.extraMins,
                    timeAdjustment: timeAdj,
                    isFollowUp: followUp,
                    confidence: Math.min(1, doctorAvg.sampleSize / 10).toFixed(2)
                }
            };
        } catch (error) {
            logger.error('Error predicting consultation duration:', error);
            return {
                predictedDuration: this.DEFAULT_DURATION,
                factors: { error: 'Prediction failed, using default' }
            };
        }
    }

    /**
     * Record actual consultation duration
     */
    async recordConsultationDuration({
        appointmentId,
        doctorId,
        patientId,
        symptoms,
        actualDurationMins,
        isFollowUp
    }) {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            const now = new Date();
            const dayOfWeek = now.getDay();
            const hourOfDay = now.getHours();

            const [doctorRows] = await conn.query(
                'SELECT specialty FROM doctors WHERE id = ?',
                [doctorId]
            );
            const doctor = doctorRows[0];

            await conn.query(
                `INSERT INTO consultation_history 
                 (doctor_id, patient_id, appointment_id, symptoms_keywords, is_follow_up, 
                  day_of_week, hour_of_day, actual_duration_mins, specialty)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    doctorId,
                    patientId,
                    appointmentId,
                    this.extractKeywords(symptoms).join(','),
                    isFollowUp,
                    dayOfWeek,
                    hourOfDay,
                    actualDurationMins,
                    doctor?.specialty || 'General'
                ]
            );

            const alpha = 0.1;
            const [currentAvgRows] = await conn.query(
                'SELECT * FROM doctor_avg_times WHERE doctor_id = ?',
                [doctorId]
            );
            const currentAvg = currentAvgRows[0];

            if (currentAvg) {
                const newAvg = (alpha * actualDurationMins) + ((1 - alpha) * currentAvg.avg_duration_mins);
                const newFollowUp = isFollowUp 
                    ? (alpha * actualDurationMins) + ((1 - alpha) * currentAvg.avg_follow_up_mins)
                    : currentAvg.avg_follow_up_mins;
                const newNewPatient = !isFollowUp
                    ? (alpha * actualDurationMins) + ((1 - alpha) * currentAvg.avg_new_patient_mins)
                    : currentAvg.avg_new_patient_mins;

                await conn.query(
                    `UPDATE doctor_avg_times 
                     SET avg_duration_mins = ?,
                         avg_follow_up_mins = ?,
                         avg_new_patient_mins = ?,
                         total_consultations = total_consultations + 1
                     WHERE doctor_id = ?`,
                    [newAvg, newFollowUp, newNewPatient, doctorId]
                );
            } else {
                await conn.query(
                    `INSERT INTO doctor_avg_times 
                     (doctor_id, avg_duration_mins, avg_follow_up_mins, avg_new_patient_mins, total_consultations)
                     VALUES (?, ?, ?, ?, 1)`,
                    [
                        doctorId,
                        actualDurationMins,
                        isFollowUp ? actualDurationMins : 10,
                        !isFollowUp ? actualDurationMins : 20
                    ]
                );
            }

            await conn.query(
                'UPDATE appointments SET actual_duration_mins = ? WHERE id = ?',
                [actualDurationMins, appointmentId]
            );

            await conn.commit();
            return { success: true };
        } catch (error) {
            await conn.rollback();
            logger.error('Error recording consultation duration:', error);
            return { success: false, error: error.message };
        } finally {
            conn.release();
        }
    }

    /**
     * Calculate total estimated wait time for a patient in queue
     */
    async calculateQueueWaitTime(appointmentId) {
        try {
            const [queueEntryRows] = await db.query(`
                SELECT lq.queue_number, a.doctor_id, a.appointment_date
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                WHERE lq.appointment_id = ?
            `, [appointmentId]);
            const queueEntry = queueEntryRows[0];

            if (!queueEntry) {
                return { estimatedWait: 0, patientsAhead: 0 };
            }

            const [aheadQueue] = await db.query(`
                SELECT a.id, lq.predicted_duration
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                WHERE a.doctor_id = ? 
                  AND a.appointment_date = ?
                  AND lq.queue_number <= ?
                  AND lq.status IN ('WAITING', 'IN_PROGRESS')
                ORDER BY lq.queue_number ASC
            `, [queueEntry.doctor_id, queueEntry.appointment_date, queueEntry.queue_number]);

            const [inProgressInfoRows] = await db.query(`
                SELECT a.id, a.consultation_start, lq.predicted_duration
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                WHERE a.doctor_id = ? 
                  AND a.appointment_date = ?
                  AND lq.status = 'IN_PROGRESS'
                LIMIT 1
            `, [queueEntry.doctor_id, queueEntry.appointment_date]);
            const inProgressInfo = inProgressInfoRows[0];

            let totalWait = 0;
            const now = new Date();

            for (const apt of aheadQueue) {
                if (apt.id === appointmentId) continue;

                let effectiveDuration = apt.predicted_duration || this.DEFAULT_DURATION;

                if (inProgressInfo && apt.id === inProgressInfo.id && inProgressInfo.consultation_start) {
                    const startTime = new Date(inProgressInfo.consultation_start);
                    const elapsedMins = Math.floor((now - startTime) / 60000);
                    effectiveDuration = Math.max(5, (inProgressInfo.predicted_duration || this.DEFAULT_DURATION) - elapsedMins);
                }

                totalWait += effectiveDuration;
            }

            return {
                estimatedWait: totalWait,
                patientsAhead: Math.max(0, aheadQueue.length - 1)
            };
        } catch (error) {
            logger.error('Error calculating queue wait time:', error);
            return { estimatedWait: 0, patientsAhead: 0, error: error.message };
        }
    }

    /**
     * Recalculate and update estimated times for all waiting patients of a doctor
     */
    async recalculateQueueEstimates(doctorId, appointmentDate) {
        try {
            const [queue] = await db.query(`
                SELECT lq.id as queue_id, lq.appointment_id, lq.queue_number,
                       a.symptoms, a.patient_id
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                WHERE a.doctor_id = ? AND a.appointment_date = ? AND lq.status = 'WAITING'
                ORDER BY lq.queue_number ASC
            `, [doctorId, appointmentDate]);

            const [inProgressRows] = await db.query(`
                SELECT a.consultation_start, lq.predicted_duration
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                WHERE a.doctor_id = ? AND a.appointment_date = ? AND lq.status = 'IN_PROGRESS'
                LIMIT 1
            `, [doctorId, appointmentDate]);
            const inProgress = inProgressRows[0];

            let cumulativeWait = 0;
            if (inProgress && inProgress.consultation_start) {
                const elapsed = Math.floor((new Date() - new Date(inProgress.consultation_start)) / 60000);
                cumulativeWait = Math.max(5, (inProgress.predicted_duration || this.DEFAULT_DURATION) - elapsed);
            }
            
            for (const entry of queue) {
                const prediction = await this.predictConsultationDuration({
                    doctorId,
                    patientId: entry.patient_id,
                    symptoms: entry.symptoms
                });

                await db.query(
                    `UPDATE live_queue SET predicted_duration = ?, estimated_time = ? WHERE id = ?`,
                    [prediction.predictedDuration, cumulativeWait, entry.queue_id]
                );

                cumulativeWait += prediction.predictedDuration;
            }

            return { updated: queue.length };
        } catch (error) {
            logger.error('Error recalculating queue estimates:', error);
            return { updated: 0, error: error.message };
        }
    }
}

module.exports = new DurationPredictionService();
