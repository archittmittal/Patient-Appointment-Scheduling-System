package com.hospital.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Algorithm Info REST Controller.
 *
 * Novel feature: Self-documenting API that describes all 7+ DSA algorithms
 * used in the system. This is useful for demos and viva presentations.
 */
@RestController
@RequestMapping("/algorithms")
public class AlgorithmInfoController {

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAlgorithmInfo() {
        return ResponseEntity.ok(Map.ofEntries(
                Map.entry("project", "Patient Appointment Scheduling System"),
                Map.entry("tagline", "DSA-powered healthcare scheduling for minimal wait times"),
                Map.entry("algorithms", Map.of(
                        "1_greedy_activity_selection", Map.of(
                                "name", "Greedy Activity Selection (First-Fit)",
                                "endpoint", "GET /api/scheduling/optimal/{doctorId}",
                                "complexity", "O(1) amortized with DB index",
                                "description", "Finds earliest available slot that fits duration — greedy choice guarantees optimal earliest-appointment"
                        ),
                        "2_greedy_load_balancing", Map.of(
                                "name", "Two-Level Greedy (Load Balance + Activity Selection)",
                                "endpoint", "GET /api/scheduling/balanced/{departmentId}",
                                "complexity", "O(d × s) → O(1) with query optimization",
                                "description", "Level 1: Pick doctor with minimum utilization. Level 2: Pick earliest available slot."
                        ),
                        "3_priority_queue", Map.of(
                                "name", "Priority Queue (Min-Heap)",
                                "endpoint", "POST /api/queue/check-in, /call-next, /emergency",
                                "complexity", "INSERT: O(log n), EXTRACT-MIN: O(log n), EMERGENCY: O(1)",
                                "description", "Min-heap with priority_score as key. Lower score = higher priority. Wait-time aging prevents starvation."
                        ),
                        "4_dp_prediction", Map.of(
                                "name", "Dynamic Programming (Wait Time Prediction)",
                                "endpoint", "GET /api/predictions/wait-time/{doctorId}",
                                "complexity", "O(1) amortized lookup against DP table",
                                "description", "Blends real-time queue state (α=0.6) with historical DP table (β=0.4). Table indexed by [doctor][day][hour]."
                        ),
                        "5_noshow_prediction", Map.of(
                                "name", "Weighted Feature Model (No-Show Prediction)",
                                "endpoint", "GET /api/predictions/no-show/{patientId}",
                                "complexity", "O(1) — constant number of feature lookups",
                                "description", "4-feature model: patient_history(0.35) + day_of_week(0.20) + hour(0.15) + advance_booking(0.30)"
                        ),
                        "6_interval_scheduling", Map.of(
                                "name", "Interval Scheduling (Conflict Detection)",
                                "endpoint", "GET /api/scheduling/conflict-check",
                                "complexity", "O(n) scan of day's appointments",
                                "description", "Two intervals overlap iff s1 < e2 AND s2 < e1. Used to prevent double-booking."
                        ),
                        "7_hash_map", Map.of(
                                "name", "Hash Map O(1) Lookup",
                                "endpoint", "GET /api/patients/verify/{uid}",
                                "complexity", "O(1) — UNIQUE index on patient_uid",
                                "description", "Instant patient identity verification at check-in using hash-based UID lookup."
                        )
                ))
        ));
    }
}
