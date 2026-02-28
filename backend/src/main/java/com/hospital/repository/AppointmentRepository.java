package com.hospital.repository;

import com.hospital.model.Appointment;
import com.hospital.model.enums.AppointmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Integer> {

    /** Find all appointments for a patient */
    List<Appointment> findByPatient_PatientIdOrderByAppointmentDateDescStartTimeDesc(Integer patientId);

    /** Find appointments for a doctor on a specific date */
    List<Appointment> findByDoctor_DoctorIdAndAppointmentDateOrderByStartTimeAsc(
            Integer doctorId, LocalDate date);

    /** Find appointments by status */
    List<Appointment> findByDoctor_DoctorIdAndAppointmentDateAndStatusIn(
            Integer doctorId, LocalDate date, List<AppointmentStatus> statuses);

    /**
     * Interval Conflict Detection — find overlapping appointments.
     * Two intervals overlap iff: start1 < end2 AND start2 < end1
     *
     * DSA: Interval Scheduling — O(n) check against existing appointments.
     */
    @Query("""
        SELECT a FROM Appointment a
        WHERE a.doctor.doctorId = :doctorId
          AND a.appointmentDate = :date
          AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
          AND a.startTime < :endTime
          AND a.endTime > :startTime
          AND (:excludeId IS NULL OR a.appointmentId != :excludeId)
    """)
    List<Appointment> findConflictingAppointments(
            @Param("doctorId") Integer doctorId,
            @Param("date") LocalDate date,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime,
            @Param("excludeId") Integer excludeAppointmentId
    );

    /**
     * Find high no-show risk appointments for proactive reminders.
     * DSA: Predictive Model — query appointments where predicted probability exceeds threshold.
     */
    @Query("""
        SELECT a FROM Appointment a
        WHERE a.status IN ('SCHEDULED', 'CONFIRMED')
          AND a.appointmentDate >= :fromDate
          AND a.appointmentDate <= :toDate
          AND a.noshowProbability >= :threshold
        ORDER BY a.noshowProbability DESC
    """)
    List<Appointment> findHighNoShowRisk(
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            @Param("threshold") BigDecimal threshold
    );

    /** Count appointments with specific status for a patient (for no-show rate) */
    long countByPatient_PatientIdAndStatus(Integer patientId, AppointmentStatus status);

    /** Count total appointments for a patient */
    long countByPatient_PatientId(Integer patientId);

    /** Find upcoming appointments for a patient */
    List<Appointment> findByPatient_PatientIdAndAppointmentDateGreaterThanEqualAndStatusIn(
            Integer patientId, LocalDate fromDate, List<AppointmentStatus> statuses);

    /**
     * Compute average actual consultation time for a doctor (last N days).
     * Used by the DP wait time prediction model.
     */
    @Query("""
        SELECT COALESCE(AVG(a.actualConsultationTime), d.avgConsultationTime)
        FROM Appointment a
        JOIN a.doctor d
        WHERE a.doctor.doctorId = :doctorId
          AND a.status = 'COMPLETED'
          AND a.appointmentDate >= :sinceDate
        GROUP BY d.avgConsultationTime
    """)
    Double findAverageConsultationTime(
            @Param("doctorId") Integer doctorId,
            @Param("sinceDate") LocalDate sinceDate
    );
}
