package com.hospital.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * System Configuration entity — algorithm tuning parameters.
 * Maps to: system_config table
 * 
 * Stores configurable weights used across DSA algorithms:
 * - URGENCY_WEIGHT: Priority Queue formula
 * - WAIT_TIME_WEIGHT: Priority Queue formula 
 * - PREDICTION_CURRENT_WEIGHT: DP prediction blend ratio
 * - PREDICTION_HISTORY_WEIGHT: DP prediction blend ratio
 * - EMERGENCY_PRIORITY: Priority Queue emergency override
 * - NOSHOW_THRESHOLD: Prediction model trigger
 */
@Entity
@Table(name = "system_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "config_id")
    private Integer configId;

    @Column(name = "config_key", nullable = false, unique = true, length = 50)
    private String configKey;

    @Column(name = "config_value", nullable = false, length = 200)
    private String configValue;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
