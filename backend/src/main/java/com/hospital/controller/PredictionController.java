package com.hospital.controller;

import com.hospital.dto.response.PredictionResponse;
import com.hospital.model.enums.QueueStatus;
import com.hospital.repository.LiveQueueRepository;
import com.hospital.service.PredictionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Prediction REST Controller — exposes DSA Prediction algorithms.
 *
 * Novel feature: Full algorithm transparency
 * - Shows DP table components (current vs historical weights)
 * - Shows no-show model feature contributions
 * - Allows parameter tuning via query params
 */
@RestController
@RequestMapping("/predictions")
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionService predictionService;
    private final LiveQueueRepository liveQueueRepository;

    // ── DP WAIT TIME PREDICTION ──────────────────────────────────────────

    @GetMapping("/wait-time/{doctorId}")
    public ResponseEntity<Map<String, Object>> predictWaitTime(
            @PathVariable Integer doctorId,
            @RequestParam(defaultValue = "15") int avgConsultMinutes) {

        long queueSize = liveQueueRepository.countByDoctor_DoctorIdAndQueueStatus(
                doctorId, QueueStatus.WAITING);

        int predicted = predictionService.predictWaitTime(
                doctorId, (int) queueSize, avgConsultMinutes);

        return ResponseEntity.ok(Map.of(
                "estimatedWaitMinutes", predicted,
                "algorithm", "Dynamic Programming (Tabulation + Blending)",
                "components", Map.of(
                        "currentQueue", Map.of(
                                "patientsAhead", queueSize,
                                "avgConsultTime", avgConsultMinutes,
                                "weight", 0.6,
                                "formula", "α × (patients_ahead × avg_consult_time)"
                        ),
                        "historical", Map.of(
                                "lookbackDays", 90,
                                "weight", 0.4,
                                "formula", "β × AVG(wait_time) from queue_history[doctor][day][hour]"
                        )
                ),
                "dpRecurrence", "predicted = α × current_estimate + β × historical_avg"
        ));
    }

    // ── NO-SHOW PREDICTION ───────────────────────────────────────────────

    @GetMapping("/no-show/{patientId}")
    public ResponseEntity<Map<String, Object>> predictNoShow(
            @PathVariable Integer patientId,
            @RequestParam String date,
            @RequestParam(defaultValue = "10") int hour) {

        LocalDate appointmentDate = LocalDate.parse(date);
        double probability = predictionService.predictNoShowProbability(
                patientId, appointmentDate, hour);
        boolean isHighRisk = predictionService.isHighNoShowRisk(
                patientId, appointmentDate, hour);

        return ResponseEntity.ok(Map.of(
                "patientId", patientId,
                "noshowProbability", String.format("%.2f", probability),
                "isHighRisk", isHighRisk,
                "algorithm", "Weighted Feature Model",
                "features", Map.of(
                        "patientHistory", Map.of("weight", 0.35,
                                "description", "Personal no-show rate from appointment history"),
                        "dayOfWeek", Map.of("weight", 0.20,
                                "description", "Historical no-show rate for " + appointmentDate.getDayOfWeek()),
                        "hourOfDay", Map.of("weight", 0.15,
                                "description", "Historical no-show rate for hour " + hour),
                        "advanceBooking", Map.of("weight", 0.30,
                                "description", "Normalized advance booking days (longer advance = higher risk)")
                ),
                "formula", "P(no_show) = 0.35×patient_rate + 0.20×day_rate + 0.15×hour_rate + 0.30×advance_factor"
        ));
    }
}
