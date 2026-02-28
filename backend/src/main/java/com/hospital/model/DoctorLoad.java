package com.hospital.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Doctor Load entity — daily load metrics per doctor.
 * Maps to: doctor_load table
 * 
 * DSA: Greedy Load Balancing
 * The utilizationPercentage is used to find the least-loaded doctor
 * when assigning new patients (Greedy: pick minimum utilization).
 */
@Entity
@Table(name = "doctor_load",
       uniqueConstraints = @UniqueConstraint(columnNames = {"doctor_id", "load_date"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DoctorLoad {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "load_id")
    private Integer loadId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @Column(name = "load_date", nullable = false)
    private LocalDate loadDate;

    @Column(name = "total_slots")
    @Builder.Default
    private Integer totalSlots = 0;

    @Column(name = "booked_slots")
    @Builder.Default
    private Integer bookedSlots = 0;

    @Column(name = "completed_appointments")
    @Builder.Default
    private Integer completedAppointments = 0;

    @Column(name = "total_patients_seen")
    @Builder.Default
    private Integer totalPatientsSeen = 0;

    @Column(name = "total_consultation_minutes")
    @Builder.Default
    private Integer totalConsultationMinutes = 0;

    /** Utilization percentage — the Greedy algorithm selects the doctor with minimum value */
    @Column(name = "utilization_percentage", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal utilizationPercentage = BigDecimal.ZERO;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
