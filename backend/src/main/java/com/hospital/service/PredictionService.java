package com.hospital.service;

import com.hospital.model.enums.AppointmentType;
import com.hospital.model.enums.DayOfWeek;
import com.hospital.model.enums.QueueStatus;
import com.hospital.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Prediction Service — Dynamic Programming + Predictive Model.
 *
 * DSA Algorithms:
 * 1. Wait Time Prediction (Dynamic Programming / Tabulation)
 * 2. No-Show Probability Prediction (Weighted Feature Model)
 *
 * DP Wait Time Prediction:
 *   Uses historical data lookup (DP table) + current queue state.
 *   predicted_wait = α × (queue_ahead × avg_consultation_time) + β × historical_avg_wait
 *   where α = PREDICTION_CURRENT_WEIGHT, β = PREDICTION_HISTORY_WEIGHT
 *
 * No-Show Prediction:
 *   Features: patient_history_rate, day_of_week_rate, hour_of_day_rate, advance_booking_days
 *   Weights: 0.35, 0.20, 0.15, 0.30
 *   P(no_show) = Σ (weight_i × feature_i), clamped to [0, 1]
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PredictionService {

    private final QueueHistoryRepository queueHistoryRepository;
    private final LiveQueueRepository liveQueueRepository;
    private final AppointmentRepository appointmentRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final PatientRepository patientRepository;

    // ========================================================================
    // DSA: DYNAMIC PROGRAMMING — Wait Time Prediction
    // ========================================================================

    /**
     * Predict wait time for a patient using Dynamic Programming.
     *
     * The DP approach:
     * 1. CURRENT STATE: Count patients ahead × avg consultation time (real-time estimate)
     * 2. HISTORICAL TABLE: Lookup average wait from queue_history by (doctor, day, hour)
     *    This IS the DP table — each cell is pre-computed from historical subproblems.
     * 3. BLEND: predicted = α × current_estimate + β × historical_average
     *    where α + β = 1 (convex combination ensures bounded prediction)
     *
     * Recurrence relation for the DP table:
     *   dp[doctor][day][hour] = AVG(actual_wait_time) for all matching history entries
     *   This is computed lazily (on-demand) via SQL AVG().
     *
     * @param doctorId Doctor ID
     * @param patientsAhead Number of patients ahead in queue
     * @param avgConsultTimeMin Average consultation time in minutes
     * @return Estimated wait time in minutes
     */
    @Transactional(readOnly = true)
    public int predictWaitTime(Integer doctorId, int patientsAhead, int avgConsultTimeMin) {
        LocalDate today = LocalDate.now();
        DayOfWeek dayOfWeek = DayOfWeek.valueOf(today.getDayOfWeek().name());
        int currentHour = java.time.LocalTime.now().getHour();

        // Step 1: CURRENT STATE estimation (real-time component)
        double currentEstimate = patientsAhead * avgConsultTimeMin;

        // Step 2: DP TABLE LOOKUP — historical average wait time
        // This queries the DP table: queue_history aggregated by (doctor, day, hour)
        LocalDate lookbackDate = today.minusDays(90); // 90 days of training data
        Double historicalAvg = queueHistoryRepository.findHistoricalAvgWaitTime(
                doctorId, dayOfWeek, currentHour, lookbackDate);

        if (historicalAvg == null) historicalAvg = 15.0; // Default fallback

        // Step 3: BLEND current + historical (DP combination)
        double alpha = getConfigDouble("PREDICTION_CURRENT_WEIGHT", 0.6); // Current weight
        double beta = getConfigDouble("PREDICTION_HISTORY_WEIGHT", 0.4);  // History weight

        double predictedWait = (alpha * currentEstimate) + (beta * historicalAvg);

        log.debug("DP Wait Prediction: doctor={}, day={}, hour={}, " +
                  "current_estimate={}, historical_avg={}, predicted={}",
                doctorId, dayOfWeek, currentHour,
                currentEstimate, historicalAvg, predictedWait);

        return Math.max(0, (int) Math.round(predictedWait));
    }

    /**
     * Predict wait time for a specific doctor queue using current queue state.
     * Convenience method that auto-calculates patientsAhead.
     */
    @Transactional(readOnly = true)
    public int predictWaitForQueue(Integer doctorId, int avgConsultTimeMin) {
        long patientsAhead = liveQueueRepository.countByDoctor_DoctorIdAndQueueStatus(
                doctorId, QueueStatus.WAITING);
        return predictWaitTime(doctorId, (int) patientsAhead, avgConsultTimeMin);
    }

    // ========================================================================
    // DSA: PREDICTIVE MODEL — No-Show Probability
    // ========================================================================

    /**
     * Predict no-show probability using a weighted feature model.
     *
     * Feature vector: [patient_rate, day_rate, hour_rate, advance_days_factor]
     * Weight vector:  [0.35,         0.20,     0.15,      0.30]
     *
     * Features:
     * 1. PATIENT HISTORY RATE (weight: 0.35)
     *    - Personal no-show rate = noshow_count / total_appointments
     *    - Highest weight because individual behavior is the best predictor
     *
     * 2. DAY-OF-WEEK RATE (weight: 0.20)
     *    - Historical no-show rate for this specific day of the week
     *    - Captures patterns like higher no-shows on Mondays
     *
     * 3. HOUR-OF-DAY RATE (weight: 0.15)
     *    - Historical no-show rate for this specific hour
     *    - Captures patterns like higher no-shows for early morning slots
     *
     * 4. ADVANCE BOOKING FACTOR (weight: 0.30)
     *    - Normalized advance booking days: min(advance_days / 30, 1.0)
     *    - Appointments booked far in advance have higher no-show rates
     *
     * @return Probability between 0.0 and 1.0
     */
    @Transactional(readOnly = true)
    public double predictNoShowProbability(Integer patientId, LocalDate appointmentDate,
                                           int appointmentHour) {
        // Feature 1: Patient personal no-show rate (O(1) from pre-computed field)
        double patientRate = patientRepository.findById(patientId)
                .map(p -> p.getNoshowRate().doubleValue())
                .orElse(0.20); // Default for new patients: 20%

        // Feature 2: Day-of-week no-show rate (from history DP table)
        DayOfWeek dayOfWeek = DayOfWeek.valueOf(appointmentDate.getDayOfWeek().name());
        LocalDate lookbackDate = LocalDate.now().minusDays(90);
        double dayRate = queueHistoryRepository.findNoshowRateByDayOfWeek(dayOfWeek, lookbackDate);

        // Feature 3: Hour-of-day no-show rate (from history DP table)
        double hourRate = queueHistoryRepository.findNoshowRateByHour(appointmentHour, lookbackDate);

        // Feature 4: Advance booking factor
        long advanceDays = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), appointmentDate);
        double advanceFactor = Math.min(advanceDays / 30.0, 1.0);

        // Weighted combination
        double prediction = (0.35 * patientRate) +
                             (0.20 * dayRate) +
                             (0.15 * hourRate) +
                             (0.30 * advanceFactor);

        // Clamp to [0, 1]
        prediction = Math.max(0.0, Math.min(1.0, prediction));

        log.debug("No-Show Prediction: patient={}, date={}, hour={}, " +
                  "patient_rate={}, day_rate={}, hour_rate={}, advance_factor={}, " +
                  "predicted_probability={}",
                patientId, appointmentDate, appointmentHour,
                patientRate, dayRate, hourRate, advanceFactor, prediction);

        return prediction;
    }

    /**
     * Check if a prediction exceeds the no-show threshold.
     * Used to decide whether to send a proactive reminder.
     */
    @Transactional(readOnly = true)
    public boolean isHighNoShowRisk(Integer patientId, LocalDate appointmentDate, int hour) {
        double threshold = getConfigDouble("NOSHOW_THRESHOLD", 0.5);
        double probability = predictNoShowProbability(patientId, appointmentDate, hour);
        return probability >= threshold;
    }

    // ========================================================================
    // HELPER
    // ========================================================================

    private double getConfigDouble(String key, double defaultValue) {
        return systemConfigRepository.findByConfigKey(key)
                .map(c -> Double.parseDouble(c.getConfigValue()))
                .orElse(defaultValue);
    }
}
