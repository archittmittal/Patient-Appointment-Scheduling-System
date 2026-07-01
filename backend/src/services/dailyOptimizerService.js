/**
 * Daily Schedule Optimizer Service
 * Phase 3: Advanced Optimization (DSA)
 * 
 * Implements load balancing and schedule optimization using:
 * 1. Global Load Balancing (Routing walk-ins to least congested doctors)
 * 2. Dynamic Programming for schedule reordering (Minimizing weighted wait time)
 */

const db = require('../config/db');
const logger = require('../config/logger');
const { predictConsultationDuration } = require('./durationPrediction');

class DailyOptimizerService {
    constructor() {
        // Ensure methods are bound to this instance
        this.getDoctorWorkloads = this.getDoctorWorkloads.bind(this);
        this.suggestDoctorForWalkin = this.suggestDoctorForWalkin.bind(this);
        this.getOptimalSequence = this.getOptimalSequence.bind(this);
    }

    /**
     * Get the current workload for all active doctors on a specific date
     * Workload = Sum of predicted durations for all WAITING and IN_PROGRESS patients
     */
    async getDoctorWorkloads(date = new Date().toISOString().split('T')[0]) {
        try {
            const [doctors] = await db.query('SELECT id, first_name, last_name, specialty FROM doctors');
            
            const workloads = await Promise.all(doctors.map(async (doctor) => {
                const [queue] = await db.query(`
                    SELECT lq.predicted_duration
                    FROM live_queue lq
                    JOIN appointments a ON lq.appointment_id = a.id
                    WHERE a.doctor_id = ? AND a.appointment_date = ?
                    AND lq.status IN ('WAITING', 'IN_PROGRESS')
                `, [doctor.id, date]);

                const totalMins = queue.reduce((sum, item) => sum + (item.predicted_duration || 15), 0);

                return {
                    doctorId: doctor.id,
                    name: `${doctor.first_name} ${doctor.last_name}`,
                    specialty: doctor.specialty,
                    patientCount: queue.length,
                    estimatedTotalMins: totalMins
                };
            }));

            return workloads.sort((a, b) => a.estimatedTotalMins - b.estimatedTotalMins);
        } catch (error) {
            logger.error('Error getting doctor workloads:', error);
            throw error;
        }
    }

    /**
     * Suggest the best doctor for a new walk-in patient based on current congestion
     */
    async suggestDoctorForWalkin(patientId, symptoms) {
        const workloads = await this.getDoctorWorkloads();
        
        // Filter by specialty if possible (can be expanded later)
        // For now, just pick the one with the lowest estimatedTotalMins
        if (workloads.length === 0) return null;

        const bestDoctor = workloads[0]; // Already sorted by estimatedTotalMins

        // Predict duration for this specific patient with the best doctor
        const prediction = await predictConsultationDuration({
            doctorId: bestDoctor.doctorId,
            patientId,
            symptoms
        });

        return {
            suggestedDoctor: bestDoctor,
            predictedWaitTime: bestDoctor.estimatedTotalMins,
            expectedConsultationDuration: prediction.predictedDuration,
            alternatives: workloads.slice(1, 3) // Top 2 alternatives
        };
    }

    /**
     * Schedule Optimization using Dynamic Programming
     * Goal: Minimize the "Total Weighted Delay"
     * Weight = Urgency Score (1-10)
     * Delay = Start Time - Scheduled Time
     * 
     * This is a variation of the Single Machine Scheduling Problem with Release Dates and Deadlines.
     * Since the number of patients in a current "burst" is small (e.g. < 10), 
     * we can use a DP with bitmask to find the optimal permutation.
     */
    async getOptimalSequence(doctorId, date = new Date().toISOString().split('T')[0]) {
        try {
            // 1. Fetch current waiting queue
            const [queue] = await db.query(`
                SELECT lq.appointment_id, a.triage_score as urgency, lq.predicted_duration as duration,
                       a.time_slot, a.patient_id, p.first_name, p.last_name
                FROM live_queue lq
                JOIN appointments a ON lq.appointment_id = a.id
                JOIN patients p ON a.patient_id = p.id
                WHERE a.doctor_id = ? AND a.appointment_date = ?
                AND lq.status = 'WAITING'
                LIMIT 10
            `, [doctorId, date]);

            if (queue.length <= 1) return queue;

            const n = queue.length;
            const memo = new Map();

            const patients = queue.map(p => ({
                ...p,
                patient_name: `${p.first_name} ${p.last_name}`,
                scheduledMins: this.slotToMins(p.time_slot)
            }));

            const startTime = this.slotToMins(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

            /**
             * DP State: (mask, currentTime)
             * mask: bitmask of patients already scheduled
             * currentTime: time when the last scheduled patient finishes
             * returns: { cost: minWeightedDelay, sequence: [] }
             */
            const solve = (mask, currentTime) => {
                if (mask === (1 << n) - 1) return { cost: 0, sequence: [] };
                
                const stateKey = `${mask}-${currentTime}`;
                if (memo.has(stateKey)) return memo.get(stateKey);

                let minCost = Infinity;
                let bestSeq = [];

                for (let i = 0; i < n; i++) {
                    if (!(mask & (1 << i))) {
                        const p = patients[i];
                        // Delay = max(0, currentTime - p.scheduledMins)
                        const delay = Math.max(0, currentTime - p.scheduledMins);
                        const next = solve(mask | (1 << i), currentTime + p.duration);
                        const cost = (delay * p.urgency) + next.cost;

                        if (cost < minCost) {
                            minCost = cost;
                            bestSeq = [p, ...next.sequence];
                        }
                    }
                }

                const result = { cost: minCost, sequence: bestSeq };
                memo.set(stateKey, result);
                return result;
            };

            const optimal = solve(0, startTime);
            
            return {
                originalSequence: patients,
                optimalSequence: optimal.sequence,
                costReduction: "Theoretical improvement in weighted wait time",
                totalWeightedDelay: optimal.cost
            };

        } catch (error) {
            logger.error('Error optimizing schedule:', error);
            throw error;
        }
    }

    /**
     * Convert time_slot to minutes from midnight
     */
    slotToMins(slot) {
        if (!slot) return 480; // Default 8 AM
        const match = slot.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return 480;
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const p = match[3].toUpperCase();
        if (p === 'PM' && h !== 12) h += 12;
        if (p === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    }
}

module.exports = new DailyOptimizerService();
