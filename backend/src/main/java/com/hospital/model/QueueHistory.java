package com.hospital.model;

import com.hospital.model.enums.AppointmentType;
import com.hospital.model.enums.DayOfWeek;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Queue History entity — historical data for wait time prediction.
 * Maps to: queue_history table
 * 
 * DSA: Dynamic Programming (Tabulation)
 * This table IS the DP lookup table. Each record is a computed subproblem.
 * Indexed by (doctor_id, day_of_week, hour_of_day) for O(1) prediction lookup.
 */
@Entity
@Table(name = "queue_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QueueHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id")
    private Integer historyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @Column(name = "appointment_id")
    private Integer appointmentId;

    @Column(name = "patient_id")
    private Integer patientId;

    // ── Time dimensions for DP pattern analysis ──────────────────────────
    @Column(name = "queue_date", nullable = false)
    private LocalDate queueDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false)
    private DayOfWeek dayOfWeek;

    /** Hour of day (0-23) — part of the DP table key */
    @Column(name = "hour_of_day", nullable = false)
    private Integer hourOfDay;

    // ── Metrics (DP table values) ────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "appointment_type")
    private AppointmentType appointmentType;

    /** Actual wait time in minutes — the value we're trying to predict */
    @Column(name = "wait_time_minutes", nullable = false)
    private Integer waitTimeMinutes;

    /** Actual consultation time */
    @Column(name = "consultation_minutes", nullable = false)
    private Integer consultationMinutes;

    /** Queue length when patient checked in */
    @Column(name = "queue_size_at_checkin")
    private Integer queueSizeAtCheckin;

    /** Whether this appointment was a no-show */
    @Column(name = "was_noshow")
    @Builder.Default
    private Boolean wasNoshow = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
