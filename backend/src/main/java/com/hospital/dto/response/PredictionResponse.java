package com.hospital.dto.response;

/**
 * Response DTO for DSA prediction outputs.
 * Bundles multiple algorithm results into a single response.
 */
public record PredictionResponse(

        // DP Wait Time Prediction
        int estimatedWaitMinutes,
        double currentQueueComponent,       // α × (patients_ahead × avg_consult)
        double historicalComponent,          // β × historical_avg
        double currentWeight,               // α (default 0.6)
        double historicalWeight,             // β (default 0.4)

        // No-Show Prediction Model
        double noshowProbability,
        double patientHistoryRate,           // Feature 1 (weight: 0.35)
        double dayOfWeekRate,                // Feature 2 (weight: 0.20)
        double hourOfDayRate,                // Feature 3 (weight: 0.15)
        double advanceBookingFactor,         // Feature 4 (weight: 0.30)
        boolean isHighRisk,

        String algorithmUsed                 // "DP_WAIT_PREDICTION" or "NOSHOW_WEIGHTED_MODEL"
) {}
