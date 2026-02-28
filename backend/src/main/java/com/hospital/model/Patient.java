package com.hospital.model;

import com.hospital.model.enums.Gender;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Patient entity with no-show prediction features.
 * Maps to: patients table
 * 
 * DSA connections:
 * - patientUid: Hash Map key for O(1) verification lookup
 * - noshowRate: Pre-computed feature for no-show prediction model
 */
@Entity
@Table(name = "patients")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "patient_id")
    private Integer patientId;

    /** Unique ID for O(1) hash-based verification at check-in */
    @Column(name = "patient_uid", nullable = false, unique = true, length = 20)
    private String patientUid;

    @Column(name = "first_name", nullable = false, length = 50)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 50)
    private String lastName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    private Gender gender;

    @Column(nullable = false, length = 15)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "emergency_contact", length = 15)
    private String emergencyContact;

    @Column(name = "blood_group", length = 5)
    private String bloodGroup;

    @Column(name = "medical_history", columnDefinition = "TEXT")
    private String medicalHistory;

    // ── No-show prediction features ──────────────────────────────────────
    @Column(name = "total_appointments")
    @Builder.Default
    private Integer totalAppointments = 0;

    @Column(name = "noshow_count")
    @Builder.Default
    private Integer noshowCount = 0;

    /** Pre-computed no-show rate for O(1) prediction lookup */
    @Column(name = "noshow_rate", precision = 3, scale = 2)
    @Builder.Default
    private BigDecimal noshowRate = BigDecimal.ZERO;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

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

    /** Helper to get full name */
    public String getFullName() {
        return firstName + " " + lastName;
    }
}
