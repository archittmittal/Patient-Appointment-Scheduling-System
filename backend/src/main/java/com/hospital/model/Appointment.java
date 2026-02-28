package com.hospital.model;

import com.hospital.model.enums.AppointmentStatus;
import com.hospital.model.enums.AppointmentType;
import com.hospital.model.enums.CaseComplexity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Appointment entity — core booking record.
 * Maps to: appointments table
 * 
 * DSA connections:
 * - Interval Scheduling: (start_time, end_time) for conflict detection
 * - Priority Queue: (priority_level, urgency_level) feed into heap key
 * - Weighted Job Scheduling: (expected_duration, case_complexity) for DP
 * - No-show Prediction: noshow_probability is pre-computed
 */
@Entity
@Table(name = "appointments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Appointment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "appointment_id")
    private Integer appointmentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "slot_id")
    private TimeSlot slot;

    @Column(name = "appointment_date", nullable = false)
    private LocalDate appointmentDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "appointment_type")
    @Builder.Default
    private AppointmentType appointmentType = AppointmentType.NEW;

    // ── Priority & Complexity (Priority Queue + Weighted Scheduling) ─────
    /** 1=Highest, 5=Lowest — base priority for heap key calculation */
    @Column(name = "priority_level")
    @Builder.Default
    private Integer priorityLevel = 3;

    /** 1=Normal, 5=Emergency — urgency factor in priority formula */
    @Column(name = "urgency_level")
    @Builder.Default
    private Integer urgencyLevel = 1;

    /** Expected consultation time in minutes — for Weighted Job Scheduling DP */
    @Column(name = "expected_duration")
    @Builder.Default
    private Integer expectedDuration = 20;

    @Enumerated(EnumType.STRING)
    @Column(name = "case_complexity")
    @Builder.Default
    private CaseComplexity caseComplexity = CaseComplexity.MODERATE;

    // ── Status ───────────────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AppointmentStatus status = AppointmentStatus.SCHEDULED;

    // ── No-show Prediction ───────────────────────────────────────────────
    /** Pre-computed no-show probability from prediction model */
    @Column(name = "noshow_probability", precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal noshowProbability = BigDecimal.ZERO;

    @Column(name = "reminder_sent")
    @Builder.Default
    private Boolean reminderSent = false;

    // ── Timestamps ───────────────────────────────────────────────────────
    @Column(name = "booked_at", updatable = false)
    private LocalDateTime bookedAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "checkin_time")
    private LocalDateTime checkinTime;

    @Column(name = "consultation_start")
    private LocalDateTime consultationStart;

    @Column(name = "consultation_end")
    private LocalDateTime consultationEnd;

    // ── Actual Metrics (for DP model training) ───────────────────────────
    /** Actual wait time in minutes — feeds back into prediction model */
    @Column(name = "actual_wait_time")
    private Integer actualWaitTime;

    /** Actual consultation time — trains future predictions */
    @Column(name = "actual_consultation_time")
    private Integer actualConsultationTime;

    // ── Notes ────────────────────────────────────────────────────────────
    @Column(name = "reason_for_visit", columnDefinition = "TEXT")
    private String reasonForVisit;

    @Column(name = "doctor_notes", columnDefinition = "TEXT")
    private String doctorNotes;

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    @PrePersist
    protected void onCreate() {
        bookedAt = LocalDateTime.now();
    }
}
