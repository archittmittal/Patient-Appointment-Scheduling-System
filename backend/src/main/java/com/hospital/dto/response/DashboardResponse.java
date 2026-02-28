package com.hospital.dto.response;

import java.util.Map;

/**
 * Dashboard analytics response — aggregated metrics for the admin dashboard.
 */
public record DashboardResponse(

        // Scheduling metrics
        int totalAppointmentsToday,
        int completedToday,
        int noShowsToday,
        int cancelledToday,

        // Queue metrics
        int totalPatientsInQueue,
        int avgWaitMinutes,

        // Load balancing metrics
        Map<String, Double> doctorUtilizations,    // doctorName -> utilization %

        // Prediction accuracy
        double avgPredictionAccuracy
) {}
