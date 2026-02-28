package com.hospital.repository;

import com.hospital.model.Waitlist;
import com.hospital.model.enums.WaitlistStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface WaitlistRepository extends JpaRepository<Waitlist, Integer> {

    /**
     * Find waitlisted patients for a doctor/date, ordered by priority (highest first)
     * then by created_at (FIFO for same priority).
     * Used when a no-show frees up a slot — offer to the highest priority waitlisted patient.
     */
    List<Waitlist> findByDoctor_DoctorIdAndPreferredDateAndStatusOrderByPriorityDescCreatedAtAsc(
            Integer doctorId, LocalDate date, WaitlistStatus status);

    List<Waitlist> findByPatient_PatientIdAndStatusIn(
            Integer patientId, List<WaitlistStatus> statuses);
}
