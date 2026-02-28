package com.hospital.repository;

import com.hospital.model.QueueHistory;
import com.hospital.model.enums.AppointmentType;
import com.hospital.model.enums.DayOfWeek;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;

@Repository
public interface QueueHistoryRepository extends JpaRepository<QueueHistory, Integer> {

    /**
     * DP Table Lookup — retrieve historical average wait time.
     * This is the core of the Dynamic Programming prediction:
     * the pre-computed average for a specific (doctor, day, hour) combination.
     *
     * DSA: Dynamic Programming (Tabulation) — O(1) amortized lookup
     * against the accumulated DP table.
     *
     * Recurrence: predicted_wait[doctor][day][hour] =
     *   AVG(actual_wait) for entries matching (doctor, day, hour) in last N days.
     */
    @Query("""
        SELECT COALESCE(AVG(qh.waitTimeMinutes), 15.0)
        FROM QueueHistory qh
        WHERE qh.doctor.doctorId = :doctorId
          AND qh.dayOfWeek = :dayOfWeek
          AND qh.hourOfDay = :hourOfDay
          AND qh.queueDate >= :sinceDate
    """)
    Double findHistoricalAvgWaitTime(
            @Param("doctorId") Integer doctorId,
            @Param("dayOfWeek") DayOfWeek dayOfWeek,
            @Param("hourOfDay") Integer hourOfDay,
            @Param("sinceDate") LocalDate sinceDate
    );

    /**
     * Historical average consultation time for a specific appointment type.
     * Part of the DP prediction model.
     */
    @Query("""
        SELECT COALESCE(AVG(qh.consultationMinutes), 15.0)
        FROM QueueHistory qh
        WHERE qh.doctor.doctorId = :doctorId
          AND qh.appointmentType = :appointmentType
          AND qh.queueDate >= :sinceDate
    """)
    Double findAvgConsultationByType(
            @Param("doctorId") Integer doctorId,
            @Param("appointmentType") AppointmentType appointmentType,
            @Param("sinceDate") LocalDate sinceDate
    );

    /**
     * Day-of-week no-show rate — feature for no-show prediction model.
     * Calculates the historical no-show rate for a given day of the week.
     *
     * DSA: Feature extraction for the Predictive Model.
     */
    @Query("""
        SELECT COALESCE(
            SUM(CASE WHEN qh.wasNoshow = true THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0),
            0.20
        )
        FROM QueueHistory qh
        WHERE qh.dayOfWeek = :dayOfWeek
          AND qh.queueDate >= :sinceDate
    """)
    Double findNoshowRateByDayOfWeek(
            @Param("dayOfWeek") DayOfWeek dayOfWeek,
            @Param("sinceDate") LocalDate sinceDate
    );

    /**
     * Hour-of-day no-show rate — feature for no-show prediction model.
     */
    @Query("""
        SELECT COALESCE(
            SUM(CASE WHEN qh.wasNoshow = true THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0),
            0.20
        )
        FROM QueueHistory qh
        WHERE qh.hourOfDay = :hourOfDay
          AND qh.queueDate >= :sinceDate
    """)
    Double findNoshowRateByHour(
            @Param("hourOfDay") Integer hourOfDay,
            @Param("sinceDate") LocalDate sinceDate
    );
}
