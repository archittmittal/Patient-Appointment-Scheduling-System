package com.hospital.model;

import com.hospital.model.enums.QueueStatus;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Live Queue entity — real-time patient queue management.
 * Maps to: live_queue table
 * 
 * DSA: Priority Queue (Min-Heap)
 * - priorityScore is the HEAP KEY (lower = higher priority)
 * - Operations: Insert (check-in), Extract-Min (call next), Heapify (reorder)
 * - Emergency patients get negative priority score (-100) for instant top position
 */
@Entity
@Table(name = "live_queue")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveQueue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "queue_id")
    private Integer queueId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appointment_id", nullable = false, unique = true)
    private Appointment appointment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    // ── Priority Queue (Heap) fields ─────────────────────────────────────
    /** Current position in queue (1 = next to be called) */
    @Column(name = "queue_position", nullable = false)
    private Integer queuePosition;

    /**
     * HEAP KEY — Lower value = higher priority (Min-Heap).
     * Formula: base_priority - (urgency_weight × urgency) + (wait_weight × wait_time)
     * Emergency override: -100 (guaranteed position 1)
     */
    @Column(name = "priority_score", nullable = false, precision = 10, scale = 2)
    private BigDecimal priorityScore;

    /** Starting priority before urgency/wait adjustments */
    @Column(name = "base_priority")
    @Builder.Default
    private Integer basePriority = 100;

    /** 1=Normal, 5=Emergency */
    @Column(name = "urgency_level")
    @Builder.Default
    private Integer urgencyLevel = 1;

    // ── Wait Time ────────────────────────────────────────────────────────
    @Column(name = "checkin_time", nullable = false)
    private LocalDateTime checkinTime;

    /** Predicted wait time from DP algorithm */
    @Column(name = "estimated_wait_minutes")
    @Builder.Default
    private Integer estimatedWaitMinutes = 0;

    /** Actual wait time (filled when patient is called) */
    @Column(name = "actual_wait_minutes")
    private Integer actualWaitMinutes;

    // ── Status ───────────────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "queue_status")
    @Builder.Default
    private QueueStatus queueStatus = QueueStatus.WAITING;

    @Column(name = "called_at")
    private LocalDateTime calledAt;

    @Column(name = "token_number", length = 10)
    private String tokenNumber;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
