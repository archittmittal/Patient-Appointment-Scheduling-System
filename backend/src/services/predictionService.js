/**
 * Predictive Intelligence Service
 * Phase 2: AI/ML based No-Show and Churn Prediction
 */

const db = require('../config/db');

const predictionService = {
    /**
     * Predict probability of a patient not showing up for a specific appointment
     * Returns: { probability: 0-1, riskLevel: 'LOW'|'MEDIUM'|'HIGH', factors: [] }
     */
    async predictNoShowProbability(appointmentId) {
        try {
            // Get appointment details
            const [appointmentRows] = await db.query(
                `SELECT a.*, p.dob, TIMESTAMPDIFF(YEAR, p.dob, CURDATE()) as age,
                        DATEDIFF(a.appointment_date, a.created_at) as lead_time_days
                 FROM appointments a
                 JOIN patients p ON a.patient_id = p.id
                 WHERE a.id = ?`,
                [appointmentId]
            );
            const appointment = appointmentRows[0];

            if (!appointment) return { probability: 0, riskLevel: 'LOW', factors: [] };

            let score = 0;
            const factors = [];

            // 1. Lead Time Factor (Longer lead time = higher no-show risk)
            if (appointment.lead_time_days > 14) {
                score += 0.3;
                factors.push('Long lead time (>14 days)');
            } else if (appointment.lead_time_days > 7) {
                score += 0.15;
                factors.push('Medium lead time (>7 days)');
            }

            // 2. Historical No-Show Factor
            const [historyRows] = await db.query(
                `SELECT 
                    COUNT(*) as total_appts,
                    SUM(CASE WHEN release_type = 'NO_SHOW' THEN 1 ELSE 0 END) as no_shows
                 FROM slot_release_log srl
                 JOIN appointments a ON srl.appointment_id = a.id
                 WHERE a.patient_id = ?`,
                [appointment.patient_id]
            );
            const history = historyRows[0];

            if (history && history.total_appts > 2) {
                const noShowRate = history.no_shows / history.total_appts;
                if (noShowRate > 0.3) {
                    score += 0.4;
                    factors.push('High historical no-show rate');
                } else if (noShowRate > 0.1) {
                    score += 0.2;
                    factors.push('Some history of missed appointments');
                }
            }

            // 3. Demographics Factor (Younger and older adults might have different patterns)
            if (appointment.age < 25 || appointment.age > 75) {
                score += 0.1;
                factors.push('Age-related reliability factor');
            }

            // 4. Time of Day Factor (Late afternoon appointments often have higher no-shows)
            const hour = parseInt(appointment.time_slot.split(':')[0]);
            const isPM = appointment.time_slot.includes('PM');
            if (isPM && hour >= 3 && hour < 6) {
                score += 0.15;
                factors.push('Peak no-show time slot (Late afternoon)');
            }

            // Normalize and determine risk level
            const probability = Math.min(score, 0.95);
            let riskLevel = 'LOW';
            if (probability > 0.6) riskLevel = 'HIGH';
            else if (probability > 0.3) riskLevel = 'MEDIUM';

            return {
                probability: parseFloat(probability.toFixed(2)),
                riskLevel,
                factors
            };
        } catch (error) {
            console.error('Error predicting no-show probability:', error);
            return { probability: 0.1, riskLevel: 'LOW', factors: ['Error in prediction model'] };
        }
    },

    /**
     * Predict probability of a patient churning (not returning)
     * Returns: { probability: 0-1, riskLevel: 'LOW'|'MEDIUM'|'HIGH', factors: [] }
     */
    async predictChurnRisk(patientId) {
        try {
            const factors = [];
            let score = 0;

            // 1. Recency Factor
            const [lastVisitRows] = await db.query(
                `SELECT appointment_date, DATEDIFF(CURDATE(), appointment_date) as days_since
                 FROM appointments
                 WHERE patient_id = ? AND status = 'COMPLETED'
                 ORDER BY appointment_date DESC LIMIT 1`,
                [patientId]
            );
            const lastVisit = lastVisitRows[0];

            if (!lastVisit) {
                // New patient, check if they missed their first appointment
                const [missedRows] = await db.query(
                    `SELECT COUNT(*) as missed_count FROM slot_release_log srl
                     JOIN appointments a ON srl.appointment_id = a.id
                     WHERE a.patient_id = ? AND srl.release_type = 'NO_SHOW'`,
                    [patientId]
                );
                const missed = missedRows[0];
                if (missed.missed_count > 0) {
                    score += 0.5;
                    factors.push('Missed first appointment');
                }
            } else if (lastVisit.days_since > 180) {
                score += 0.4;
                factors.push('No visit in over 6 months');
            } else if (lastVisit.days_since > 90) {
                score += 0.2;
                factors.push('No visit in over 3 months');
            }

            // 2. Feedback Factor
            const [feedbackRows] = await db.query(
                `SELECT AVG(weighted_score) as avg_score, AVG(sentiment_score) as avg_sentiment
                 FROM appointment_feedback
                 WHERE patient_id = ?`,
                [patientId]
            );
            const feedback = feedbackRows[0];

            if (feedback && feedback.avg_score > 0) {
                if (feedback.avg_score < 2.5) {
                    score += 0.5;
                    factors.push('Very low satisfaction score');
                } else if (feedback.avg_score < 3.5) {
                    score += 0.25;
                    factors.push('Moderate satisfaction score');
                }

                if (feedback.avg_sentiment < 0.3) {
                    score += 0.2;
                    factors.push('Negative sentiment in feedback');
                }
            }

            // 3. Follow-up Compliance
            const [followupRows] = await db.query(
                `SELECT 
                    COUNT(*) as total_followups,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
                 FROM appointments
                 WHERE patient_id = ? AND is_follow_up = TRUE`,
                [patientId]
            );
            const followup = followupRows[0];

            if (followup && followup.total_followups > 0) {
                const compliance = followup.completed / followup.total_followups;
                if (compliance < 0.5) {
                    score += 0.3;
                    factors.push('Low follow-up compliance');
                }
            }

            // Normalize and determine risk level
            const probability = Math.min(score, 0.95);
            let riskLevel = 'LOW';
            if (probability > 0.6) riskLevel = 'HIGH';
            else if (probability > 0.3) riskLevel = 'MEDIUM';

            return {
                probability: parseFloat(probability.toFixed(2)),
                riskLevel,
                factors
            };
        } catch (error) {
            console.error('Error predicting churn risk:', error);
            return { probability: 0.2, riskLevel: 'LOW', factors: ['Error in churn model'] };
        }
    },

    /**
     * Get aggregated predictive analytics for a doctor
     */
    async getDoctorPredictiveAnalytics(doctorId) {
        try {
            // 1. Appointments at high risk of no-show today/tomorrow
            const [upcomingAppts] = await db.query(
                `SELECT id, patient_id FROM appointments 
                 WHERE doctor_id = ? 
                   AND appointment_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                   AND status = 'CONFIRMED'`,
                [doctorId]
            );

            const highRiskNoShows = [];
            for (const appt of upcomingAppts) {
                const prediction = await this.predictNoShowProbability(appt.id);
                if (prediction.probability > 0.5) {
                    highRiskNoShows.push({
                        appointmentId: appt.id,
                        patientId: appt.patient_id,
                        ...prediction
                    });
                }
            }

            // 2. Patients at high risk of churning
            const [patients] = await db.query(
                `SELECT DISTINCT patient_id FROM appointments WHERE doctor_id = ?`,
                [doctorId]
            );

            const highRiskChurn = [];
            for (const p of patients) {
                const prediction = await this.predictChurnRisk(p.patient_id);
                if (prediction.probability > 0.6) {
                    highRiskChurn.push({
                        patientId: p.patient_id,
                        ...prediction
                    });
                }
            }

            return {
                highRiskNoShows,
                highRiskChurn,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Error getting doctor predictive analytics:', error);
            throw error;
        }
    }
};

module.exports = predictionService;
