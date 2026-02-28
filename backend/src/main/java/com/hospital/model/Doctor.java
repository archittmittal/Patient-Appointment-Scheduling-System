package com.hospital.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Doctor entity with scheduling parameters.
 * Maps to: doctors table
 * 
 * DSA connections:
 * - avgConsultationTime: used in Wait Time Prediction (DP)
 * - maxPatientsPerDay: used in Load Balancing (Greedy)
 * - preferredBufferTime: used in Buffer Allocation (Greedy)
 */
@Entity
@Table(name = "doctors")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Doctor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "doctor_id")
    private Integer doctorId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    @Column(name = "employee_id", nullable = false, unique = true, length = 20)
    private String employeeId;

    @Column(name = "first_name", nullable = false, length = 50)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 50)
    private String lastName;

    @Column(length = 100)
    private String specialization;

    @Column(length = 200)
    private String qualification;

    @Column(name = "experience_years")
    @Builder.Default
    private Integer experienceYears = 0;

    /** Average consultation time in minutes — used by DP wait time prediction */
    @Column(name = "avg_consultation_time")
    @Builder.Default
    private Integer avgConsultationTime = 15;

    /** Maximum patients per day — used by Greedy load balancing */
    @Column(name = "max_patients_per_day")
    @Builder.Default
    private Integer maxPatientsPerDay = 40;

    /** Buffer time between appointments in minutes — used by Greedy buffer allocation */
    @Column(name = "preferred_buffer_time")
    @Builder.Default
    private Integer preferredBufferTime = 5;

    @Column(length = 15)
    private String phone;

    @Column(unique = true, length = 100)
    private String email;

    @Column(precision = 2, scale = 1)
    @Builder.Default
    private BigDecimal rating = new BigDecimal("4.0");

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
