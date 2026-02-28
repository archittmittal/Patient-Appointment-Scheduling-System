package com.hospital.repository;

import com.hospital.model.TimeSlot;
import com.hospital.model.enums.SlotStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TimeSlotRepository extends JpaRepository<TimeSlot, Integer> {

    /**
     * Greedy first-fit slot search — find available slots sorted by start time.
     * The Greedy algorithm picks the FIRST result (earliest available slot).
     *
     * DSA: Greedy Activity Selection — O(n) scan, but practically O(1) with LIMIT.
     * Slots are pre-sorted by start_time for optimal greedy selection.
     */
    List<TimeSlot> findByDoctor_DoctorIdAndSlotDateAndSlotStatusOrderByStartTimeAsc(
            Integer doctorId, LocalDate date, SlotStatus status);

    /**
     * Find the first available slot with minimum duration requirement.
     * This is the core Greedy first-fit query.
     *
     * DSA: Activity Selection — greedy choice property guarantees optimality
     * for earliest-appointment scheduling.
     */
    @Query("""
        SELECT ts FROM TimeSlot ts
        WHERE ts.doctor.doctorId = :doctorId
          AND ts.slotDate = :date
          AND ts.slotStatus = 'AVAILABLE'
          AND ts.slotDuration >= :minDuration
        ORDER BY ts.startTime ASC
    """)
    List<TimeSlot> findAvailableSlotsGreedy(
            @Param("doctorId") Integer doctorId,
            @Param("date") LocalDate date,
            @Param("minDuration") Integer minDuration
    );

    /**
     * Find the optimal slot with load balancing across all doctors in a department.
     * Step 1: Joins doctors with their load metrics
     * Step 2: Sorts by utilization (least loaded first), then by earliest slot
     *
     * DSA: Greedy Load Balancing + Activity Selection combined.
     */
    @Query("""
        SELECT ts FROM TimeSlot ts
        JOIN ts.doctor d
        LEFT JOIN DoctorLoad dl ON d.doctorId = dl.doctor.doctorId AND dl.loadDate = :date
        WHERE d.department.departmentId = :deptId
          AND d.isActive = true
          AND ts.slotDate = :date
          AND ts.slotStatus = 'AVAILABLE'
          AND ts.slotDuration >= :minDuration
        ORDER BY COALESCE(dl.utilizationPercentage, 0) ASC, ts.startTime ASC
    """)
    List<TimeSlot> findAvailableSlotsLoadBalanced(
            @Param("deptId") Integer departmentId,
            @Param("date") LocalDate date,
            @Param("minDuration") Integer minDuration
    );

    /** Count available slots for a doctor on a date */
    long countByDoctor_DoctorIdAndSlotDateAndSlotStatus(
            Integer doctorId, LocalDate date, SlotStatus status);

    /** Find slots in a date range for a doctor */
    List<TimeSlot> findByDoctor_DoctorIdAndSlotDateBetweenOrderBySlotDateAscStartTimeAsc(
            Integer doctorId, LocalDate startDate, LocalDate endDate);

    /** Check if a specific slot already exists (for slot generation idempotency) */
    boolean existsByDoctor_DoctorIdAndSlotDateAndStartTime(
            Integer doctorId, LocalDate date, LocalTime startTime);
}
