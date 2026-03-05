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

// Default consultation time if no data available
const DEFAULT_DURATION = 15;
const MIN_DURATION = 5;
const MAX_DURATION = 60;

/**
 * Extract keywords from symptoms text
 * Simple NLP: lowercase, split by spaces/punctuation, filter short words
 */
function extractKeywords(symptomsText) {
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
 * Returns: { score: number, extraMins: number }
 */
async function calculateSymptomComplexity(symptomsText) {
    const keywords = extractKeywords(symptomsText);
    
    if (keywords.length === 0) {
        return { score: 1.0, extraMins: 0 };
    }

    try {
        // Get complexity scores for matching keywords
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

        // Calculate weighted average complexity
        const totalScore = rows.reduce((sum, r) => sum + parseFloat(r.complexity_score), 0);
        const totalExtraMins = rows.reduce((sum, r) => sum + r.avg_extra_mins, 0);
        
        return {
            score: totalScore / rows.length,
            extraMins: Math.round(totalExtraMins / rows.length)
        };
    } catch (error) {
        console.error('Error calculating symptom complexity:', error);
        return { score: 1.0, extraMins: 0 };
    }
}

/**
 * Get doctor's average consultation times
 */
async function getDoctorAverages(doctorId) {
    try {
        const [[row]] = await db.query(
            `SELECT avg_duration_mins, avg_new_patient_mins, avg_follow_up_mins, total_consultations
             FROM doctor_avg_times WHERE doctor_id = ?`,
            [doctorId]
        );

        if (row && row.total_consultations > 0) {
            return {
                avgDuration: parseFloat(row.avg_duration_mins),
                avgNewPatient: parseFloat(row.avg_new_patient_mins),
                avgFollowUp: parseFloat(row.avg_follow_up_mins),
                sampleSize: row.total_consultations
            };
        }

        // Fall back to specialty-based average
        const [[specialtyAvg]] = await db.query(
            `SELECT AVG(ch.actual_duration_mins) as avg_duration
             FROM consultation_history ch
             JOIN doctors d ON ch.doctor_id = d.id
             WHERE d.specialty = (SELECT specialty FROM doctors WHERE id = ?)
             AND ch.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`,
            [doctorId]
        );

        return {
            avgDuration: specialtyAvg?.avg_duration || DEFAULT_DURATION,
            avgNewPatient: DEFAULT_DURATION + 5,
            avgFollowUp: DEFAULT_DURATION - 3,
            sampleSize: 0
        };
    } catch (error) {
        console.error('Error getting doctor averages:', error);
        return {
            avgDuration: DEFAULT_DURATION,
            avgNewPatient: DEFAULT_DURATION + 5,
            avgFollowUp: DEFAULT_DURATION - 3,
            sampleSize: 0
        };
    }
}

/**
 * Check if patient has visited this doctor before (follow-up detection)
 */
async function isFollowUpPatient(patientId, doctorId) {
    try {
        const [[result]] = await db.query(
            `SELECT COUNT(*) as visits FROM appointments 
             WHERE patient_id = ? AND doctor_id = ? AND status = 'COMPLETED'`,
            [patientId, doctorId]
        );
        return result.visits > 0;
    } catch (error) {
        return false;
    }
}

/**
 * Get time-based adjustment factor
 * Early morning and late afternoon tend to run longer
 */
function getTimeAdjustment(timeSlot) {
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

    // Early morning (before 10 AM): doctors warming up, +2 mins
    if (hour < 10) return 2;
    // Late afternoon (after 4 PM): fatigue factor, +3 mins
    if (hour >= 16) return 3;
    // Peak hours (10 AM - 1 PM): efficient, -1 min
    if (hour >= 10 && hour <= 13) return -1;
    
    return 0;
}

/**
 * Main prediction function
 * Combines all factors to predict consultation duration
 * 
 * Formula: baseDuration * complexityScore + extraMins + timeAdjustment + patientTypeAdjustment
 */
async function predictConsultationDuration({
    doctorId,
    patientId,
    symptoms,
    timeSlot,
    isFollowUp = null
}) {
    try {
        // 1. Get doctor's historical averages
        const doctorAvg = await getDoctorAverages(doctorId);
        
        // 2. Determine if follow-up (auto-detect or use provided value)
        const followUp = isFollowUp !== null ? isFollowUp : await isFollowUpPatient(patientId, doctorId);
        
        // 3. Get base duration based on patient type
        let baseDuration = followUp ? doctorAvg.avgFollowUp : doctorAvg.avgNewPatient;
        
        // 4. Calculate symptom complexity
        const complexity = await calculateSymptomComplexity(symptoms);
        
        // 5. Get time-based adjustment
        const timeAdj = getTimeAdjustment(timeSlot);
        
        // 6. Calculate final prediction
        let predicted = (baseDuration * complexity.score) + complexity.extraMins + timeAdj;
        
        // 7. Apply confidence weighting based on sample size
        // If doctor has few consultations, blend with default
        if (doctorAvg.sampleSize < 10) {
            const confidence = doctorAvg.sampleSize / 10;
            predicted = (predicted * confidence) + (DEFAULT_DURATION * (1 - confidence));
        }
        
        // 8. Clamp to reasonable range
        predicted = Math.round(Math.max(MIN_DURATION, Math.min(MAX_DURATION, predicted)));
        
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
        console.error('Error predicting consultation duration:', error);
        return {
            predictedDuration: DEFAULT_DURATION,
            factors: { error: 'Prediction failed, using default' }
        };
    }
}

/**
 * Record actual consultation duration (called when consultation completes)
 * Updates the rolling averages for the doctor
 */
async function recordConsultationDuration({
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

        // Get doctor specialty
        const [[doctor]] = await conn.query(
            'SELECT specialty FROM doctors WHERE id = ?',
            [doctorId]
        );

        // 1. Insert into consultation_history
        await conn.query(
            `INSERT INTO consultation_history 
             (doctor_id, patient_id, appointment_id, symptoms_keywords, is_follow_up, 
              day_of_week, hour_of_day, actual_duration_mins, specialty)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                doctorId,
                patientId,
                appointmentId,
                extractKeywords(symptoms).join(','),
                isFollowUp,
                dayOfWeek,
                hourOfDay,
                actualDurationMins,
                doctor?.specialty || 'General'
            ]
        );

        // 2. Update doctor_avg_times with exponential moving average
        // EMA gives more weight to recent consultations
        const alpha = 0.1; // Smoothing factor

        const [[currentAvg]] = await conn.query(
            'SELECT * FROM doctor_avg_times WHERE doctor_id = ?',
            [doctorId]
        );

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

        // 3. Update the appointment record
        await conn.query(
            'UPDATE appointments SET actual_duration_mins = ? WHERE id = ?',
            [actualDurationMins, appointmentId]
        );

        await conn.commit();
        return { success: true };
    } catch (error) {
        await conn.rollback();
        console.error('Error recording consultation duration:', error);
        return { success: false, error: error.message };
    } finally {
        conn.release();
    }
}

/**
 * Calculate total estimated wait time for a patient in queue
 * Sums predicted durations of all patients ahead in queue
 */
async function calculateQueueWaitTime(appointmentId) {
    try {
        // Get this appointment's queue position and doctor
        const [[queueEntry]] = await db.query(`
            SELECT lq.queue_number, a.doctor_id, a.appointment_date
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE lq.appointment_id = ?
        `, [appointmentId]);

        if (!queueEntry) {
            return { estimatedWait: 0, patientsAhead: 0 };
        }

        // Get all appointments ahead in queue with WAITING status
        const [aheadQueue] = await db.query(`
            SELECT a.id, a.symptoms, a.patient_id, lq.predicted_duration,
                   (SELECT COUNT(*) > 0 FROM appointments prev 
                    WHERE prev.patient_id = a.patient_id 
                    AND prev.doctor_id = a.doctor_id 
                    AND prev.status = 'COMPLETED') as is_follow_up
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE a.doctor_id = ? 
              AND a.appointment_date = ?
              AND lq.queue_number < ?
              AND lq.status IN ('WAITING', 'IN_PROGRESS')
            ORDER BY lq.queue_number ASC
        `, [queueEntry.doctor_id, queueEntry.appointment_date, queueEntry.queue_number]);

        // Calculate total wait time
        let totalWait = 0;
        for (const apt of aheadQueue) {
            // Use stored predicted_duration if available, otherwise predict
            if (apt.predicted_duration) {
                totalWait += apt.predicted_duration;
            } else {
                const prediction = await predictConsultationDuration({
                    doctorId: queueEntry.doctor_id,
                    patientId: apt.patient_id,
                    symptoms: apt.symptoms,
                    isFollowUp: apt.is_follow_up
                });
                totalWait += prediction.predictedDuration;
            }
        }

        return {
            estimatedWait: totalWait,
            patientsAhead: aheadQueue.length
        };
    } catch (error) {
        console.error('Error calculating queue wait time:', error);
        return { estimatedWait: 0, patientsAhead: 0, error: error.message };
    }
}

/**
 * Recalculate and update estimated times for all waiting patients of a doctor
 * Called when a consultation completes or queue changes
 */
async function recalculateQueueEstimates(doctorId, appointmentDate) {
    try {
        const [queue] = await db.query(`
            SELECT lq.id as queue_id, lq.appointment_id, lq.queue_number,
                   a.symptoms, a.patient_id
            FROM live_queue lq
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE a.doctor_id = ? AND a.appointment_date = ? AND lq.status = 'WAITING'
            ORDER BY lq.queue_number ASC
        `, [doctorId, appointmentDate]);

        let cumulativeWait = 0;
        
        for (const entry of queue) {
            const prediction = await predictConsultationDuration({
                doctorId,
                patientId: entry.patient_id,
                symptoms: entry.symptoms
            });

            // Update this entry's predicted duration and cumulative wait
            await db.query(
                `UPDATE live_queue SET predicted_duration = ?, estimated_time = ? WHERE id = ?`,
                [prediction.predictedDuration, cumulativeWait, entry.queue_id]
            );

            cumulativeWait += prediction.predictedDuration;
        }

        return { updated: queue.length };
    } catch (error) {
        console.error('Error recalculating queue estimates:', error);
        return { updated: 0, error: error.message };
    }
}

module.exports = {
    predictConsultationDuration,
    recordConsultationDuration,
    calculateQueueWaitTime,
    recalculateQueueEstimates,
    extractKeywords,
    DEFAULT_DURATION
};
