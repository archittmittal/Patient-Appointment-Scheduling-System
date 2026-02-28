package com.hospital.service;

import com.hospital.exception.ResourceNotFoundException;
import com.hospital.exception.SchedulingConflictException;
import com.hospital.model.*;
import com.hospital.model.enums.SlotStatus;
import com.hospital.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Scheduling Service — Greedy Algorithm implementations.
 *
 * DSA Algorithms implemented:
 * 1. Activity Selection (First-Fit Greedy) — find optimal available slot
 * 2. Load-Balanced Slot Selection — Greedy + minimum utilization
 * 3. Slot Generation — pre-compute time slots from doctor schedules
 * 4. Interval Conflict Detection — overlap check before booking
 * 5. Buffer Time Allocation — greedy buffer insertion between appointments
 *
 * Time Complexity:
 * - findOptimalSlot: O(n) where n = slots for that day (O(1) with DB index + LIMIT)
 * - findLoadBalancedSlot: O(d × s) where d = doctors, s = slots (O(1) with DB query)
 * - generateSlots: O(days × slots_per_day)
 * - hasConflict: O(n) where n = appointments that day
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SchedulingService {

    private final TimeSlotRepository timeSlotRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorScheduleRepository scheduleRepository;
    private final AppointmentRepository appointmentRepository;

    // ========================================================================
    // GREEDY ALGORITHM 1: Activity Selection (First-Fit)
    // ========================================================================

    /**
     * Find the optimal available slot for a doctor on a given date.
     *
     * GREEDY CHOICE: Pick the EARLIEST available slot that fits the duration.
     * OPTIMAL SUBSTRUCTURE: First available slot minimizes patient wait time.
     *
     * This is the Activity Selection problem from CLRS Chapter 16:
     * - Activities (slots) are sorted by start time
     * - We greedily select the first compatible activity
     *
     * @param doctorId Doctor to find slot for
     * @param date Date to search
     * @param durationNeeded Minimum slot duration in minutes
     * @return First available slot, or null if none available
     */
    @Transactional(readOnly = true)
    public TimeSlot findOptimalSlot(Integer doctorId, LocalDate date, int durationNeeded) {
        log.debug("Greedy first-fit search: doctor={}, date={}, duration={}",
                doctorId, date, durationNeeded);

        // Greedy: fetch slots sorted by start_time, take the first that fits
        List<TimeSlot> availableSlots = timeSlotRepository.findAvailableSlotsGreedy(
                doctorId, date, durationNeeded);

        if (availableSlots.isEmpty()) {
            log.info("No available slots found for doctor {} on {}", doctorId, date);
            return null;
        }

        // GREEDY CHOICE: First element = earliest available slot = optimal
        TimeSlot selected = availableSlots.get(0);
        log.info("Greedy selected slot: {} ({}–{}) for doctor {}",
                selected.getSlotId(), selected.getStartTime(), selected.getEndTime(), doctorId);

        return selected;
    }

    // ========================================================================
    // GREEDY ALGORITHM 2: Load-Balanced Slot Selection
    // ========================================================================

    /**
     * Find the optimal slot with LOAD BALANCING across doctors in a department.
     *
     * TWO-LEVEL GREEDY:
     * Level 1: Pick the doctor with MINIMUM utilization (Greedy load balance)
     * Level 2: Pick the EARLIEST available slot for that doctor (Greedy first-fit)
     *
     * The combined approach ensures even patient distribution AND minimal wait time.
     *
     * @param departmentId Department to search across
     * @param date Date to search
     * @param durationNeeded Minimum slot duration
     * @return Best available slot across all department doctors
     */
    @Transactional(readOnly = true)
    public TimeSlot findLoadBalancedSlot(Integer departmentId, LocalDate date, int durationNeeded) {
        log.debug("Load-balanced Greedy search: dept={}, date={}, duration={}",
                departmentId, date, durationNeeded);

        // Single query: JOIN doctors + loads + slots, ORDER BY utilization ASC, start_time ASC
        List<TimeSlot> slots = timeSlotRepository.findAvailableSlotsLoadBalanced(
                departmentId, date, durationNeeded);

        if (slots.isEmpty()) {
            log.info("No available slots in department {} on {}", departmentId, date);
            return null;
        }

        // GREEDY CHOICE: First element = least loaded doctor's earliest slot
        TimeSlot selected = slots.get(0);
        log.info("Load-balanced selection: slot {} for doctor {} (least loaded)",
                selected.getSlotId(), selected.getDoctor().getDoctorId());

        return selected;
    }

    // ========================================================================
    // INTERVAL CONFLICT DETECTION
    // ========================================================================

    /**
     * Check if a proposed time interval conflicts with existing appointments.
     *
     * INTERVAL OVERLAP RULE: Two intervals [s1,e1) and [s2,e2) overlap
     * if and only if: s1 < e2 AND s2 < e1
     *
     * @return true if there IS a conflict (overlap exists)
     */
    @Transactional(readOnly = true)
    public boolean hasConflict(Integer doctorId, LocalDate date,
                               LocalTime startTime, LocalTime endTime,
                               Integer excludeAppointmentId) {
        List<Appointment> conflicts = appointmentRepository.findConflictingAppointments(
                doctorId, date, startTime, endTime, excludeAppointmentId);

        if (!conflicts.isEmpty()) {
            log.warn("Interval conflict detected: doctor={}, date={}, {}–{}, {} conflicting appointments",
                    doctorId, date, startTime, endTime, conflicts.size());
        }

        return !conflicts.isEmpty();
    }

    /**
     * Validate and throw exception if conflict exists.
     */
    public void validateNoConflict(Integer doctorId, LocalDate date,
                                   LocalTime startTime, LocalTime endTime,
                                   Integer excludeAppointmentId) {
        if (hasConflict(doctorId, date, startTime, endTime, excludeAppointmentId)) {
            throw new SchedulingConflictException(String.format(
                    "Scheduling conflict: Doctor %d already has an appointment at %s on %s",
                    doctorId, startTime, date));
        }
    }

    // ========================================================================
    // SLOT GENERATION (Pre-compute for Greedy search)
    // ========================================================================

    /**
     * Generate time slots for a doctor for a date range based on their weekly schedule.
     *
     * This pre-computes the slots so the Greedy search can work efficiently.
     * Includes BUFFER TIME between slots (Greedy buffer allocation).
     *
     * @param doctorId Doctor to generate slots for
     * @param startDate Start of date range
     * @param endDate End of date range
     * @return Number of slots generated
     */
    @Transactional
    public int generateTimeSlots(Integer doctorId, LocalDate startDate, LocalDate endDate) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", "id", doctorId));

        int bufferMinutes = doctor.getPreferredBufferTime(); // Greedy buffer allocation parameter
        int slotsGenerated = 0;

        LocalDate currentDate = startDate;
        while (!currentDate.isAfter(endDate)) {
            final LocalDate date = currentDate;

            // Get schedule for this day of the week
            com.hospital.model.enums.DayOfWeek dayOfWeek =
                    com.hospital.model.enums.DayOfWeek.valueOf(date.getDayOfWeek().name());

            scheduleRepository.findByDoctor_DoctorIdAndDayOfWeekAndIsAvailableTrue(doctorId, dayOfWeek)
                    .ifPresent(schedule -> {
                        // Generate morning slots
                        if (schedule.getMorningStart() != null && schedule.getMorningEnd() != null) {
                            generateSlotsForPeriod(doctor, date,
                                    schedule.getMorningStart(), schedule.getMorningEnd(),
                                    schedule.getSlotDuration(), bufferMinutes);
                        }
                        // Generate afternoon slots
                        if (schedule.getAfternoonStart() != null && schedule.getAfternoonEnd() != null) {
                            generateSlotsForPeriod(doctor, date,
                                    schedule.getAfternoonStart(), schedule.getAfternoonEnd(),
                                    schedule.getSlotDuration(), bufferMinutes);
                        }
                    });

            currentDate = currentDate.plusDays(1);
        }

        log.info("Generated slots for doctor {} from {} to {}", doctorId, startDate, endDate);
        return slotsGenerated;
    }

    /**
     * Generate slots for a specific time period with buffer time.
     *
     * GREEDY BUFFER ALLOCATION: After each slot, add buffer minutes
     * to prevent rushed consultations. The buffer is a greedy choice
     * that locally optimizes each transition without global optimization.
     */
    private void generateSlotsForPeriod(Doctor doctor, LocalDate date,
                                        LocalTime periodStart, LocalTime periodEnd,
                                        int slotDuration, int bufferMinutes) {
        LocalTime currentTime = periodStart;

        while (currentTime.plusMinutes(slotDuration).compareTo(periodEnd) <= 0) {
            // Skip if slot already exists (idempotent generation)
            if (!timeSlotRepository.existsByDoctor_DoctorIdAndSlotDateAndStartTime(
                    doctor.getDoctorId(), date, currentTime)) {

                TimeSlot slot = TimeSlot.builder()
                        .doctor(doctor)
                        .slotDate(date)
                        .startTime(currentTime)
                        .endTime(currentTime.plusMinutes(slotDuration))
                        .slotDuration(slotDuration)
                        .slotStatus(SlotStatus.AVAILABLE)
                        .build();

                timeSlotRepository.save(slot);
            }

            // GREEDY: Advance by slot_duration + buffer (local optimal spacing)
            currentTime = currentTime.plusMinutes(slotDuration + bufferMinutes);
        }
    }
}
