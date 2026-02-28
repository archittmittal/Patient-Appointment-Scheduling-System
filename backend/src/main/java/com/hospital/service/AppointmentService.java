package com.hospital.service;

import com.hospital.exception.InvalidOperationException;
import com.hospital.exception.ResourceNotFoundException;
import com.hospital.model.*;
import com.hospital.model.enums.AppointmentStatus;
import com.hospital.model.enums.SlotStatus;
import com.hospital.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Appointment Service — orchestrates booking, cancellation, and no-show handling.
 *
 * This service ties together multiple DSA algorithms:
 * - Greedy slot selection (via SchedulingService)
 * - Interval conflict detection (via SchedulingService)
 * - No-show prediction (via PredictionService)
 * - Patient hash lookup (via PatientRepository)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final TimeSlotRepository timeSlotRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final DoctorLoadRepository doctorLoadRepository;
    private final SchedulingService schedulingService;
    private final PredictionService predictionService;

    // ========================================================================
    // BOOK APPOINTMENT (Integrates Greedy + Conflict Detection + Prediction)
    // ========================================================================

    /**
     * Book an appointment combining multiple DSA algorithms.
     *
     * Algorithm Pipeline:
     * 1. Hash Map lookup — verify patient exists via O(1) UID check
     * 2. Greedy Activity Selection — find the best available slot
     * 3. Interval Conflict Detection — validate no overlapping appointments
     * 4. No-Show Prediction — calculate probability and attach to booking
     * 5. Load Balancing — update doctor utilization metrics
     */
    @Transactional
    public Appointment bookAppointment(Integer patientId, Integer doctorId,
                                        LocalDate date, LocalTime startTime,
                                        LocalTime endTime, String reason) {
        // 1. Validate patient and doctor exist
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient", "id", patientId));
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", "id", doctorId));

        // 2. Interval Conflict Detection — check for overlapping appointments
        schedulingService.validateNoConflict(doctorId, date, startTime, endTime, null);

        // 3. Find and book the slot
        TimeSlot slot = timeSlotRepository
                .findByDoctor_DoctorIdAndSlotDateAndSlotStatusOrderByStartTimeAsc(
                        doctorId, date, SlotStatus.AVAILABLE)
                .stream()
                .filter(s -> !s.getStartTime().isAfter(startTime) && !s.getEndTime().isBefore(endTime))
                .findFirst()
                .orElse(null);

        if (slot != null) {
            slot.setSlotStatus(SlotStatus.BOOKED);
            timeSlotRepository.save(slot);
        }

        // 4. No-Show Prediction — pre-compute probability
        double noshowProb = predictionService.predictNoShowProbability(
                patientId, date, startTime.getHour());

        // 5. Create the appointment
        Appointment appointment = Appointment.builder()
                .patient(patient)
                .doctor(doctor)
                .slot(slot)
                .appointmentDate(date)
                .startTime(startTime)
                .endTime(endTime)
                .noshowProbability(BigDecimal.valueOf(noshowProb)
                        .setScale(2, java.math.RoundingMode.HALF_UP))
                .reasonForVisit(reason)
                .build();

        Appointment saved = appointmentRepository.save(appointment);

        // 6. Update load metrics for load balancing algorithm
        updateDoctorLoad(doctorId, date);

        // Update patient metrics
        patient.setTotalAppointments(patient.getTotalAppointments() + 1);
        patientRepository.save(patient);

        log.info("Appointment booked: id={}, patient={}, doctor={}, date={}, noshow_prob={}",
                saved.getAppointmentId(), patientId, doctorId, date, noshowProb);

        return saved;
    }

    /**
     * Book an appointment using auto-scheduling (Greedy slot selection).
     * The system automatically picks the best slot.
     */
    @Transactional
    public Appointment bookWithAutoScheduling(Integer patientId, Integer doctorId,
                                              LocalDate date, int durationNeeded,
                                              String reason) {
        // Greedy: find best available slot
        TimeSlot optimalSlot = schedulingService.findOptimalSlot(doctorId, date, durationNeeded);

        if (optimalSlot == null) {
            throw new InvalidOperationException(
                    "No available slots for this doctor on " + date);
        }

        return bookAppointment(patientId, doctorId, date,
                optimalSlot.getStartTime(), optimalSlot.getEndTime(), reason);
    }

    /**
     * Book using load-balanced auto-scheduling across a department.
     */
    @Transactional
    public Appointment bookWithLoadBalancing(Integer patientId, Integer departmentId,
                                             LocalDate date, int durationNeeded,
                                             String reason) {
        TimeSlot optimalSlot = schedulingService.findLoadBalancedSlot(
                departmentId, date, durationNeeded);

        if (optimalSlot == null) {
            throw new InvalidOperationException(
                    "No available slots in this department on " + date);
        }

        return bookAppointment(patientId, optimalSlot.getDoctor().getDoctorId(), date,
                optimalSlot.getStartTime(), optimalSlot.getEndTime(), reason);
    }

    // ========================================================================
    // CANCEL APPOINTMENT
    // ========================================================================

    @Transactional
    public Appointment cancelAppointment(Integer appointmentId, String reason) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        if (appointment.getStatus() == AppointmentStatus.COMPLETED ||
            appointment.getStatus() == AppointmentStatus.CANCELLED) {
            throw new InvalidOperationException(
                    "Cannot cancel appointment with status: " + appointment.getStatus());
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationReason(reason);

        // Release the slot back to AVAILABLE
        if (appointment.getSlot() != null) {
            TimeSlot slot = appointment.getSlot();
            slot.setSlotStatus(SlotStatus.AVAILABLE);
            timeSlotRepository.save(slot);
        }

        // Update load metrics
        updateDoctorLoad(appointment.getDoctor().getDoctorId(), appointment.getAppointmentDate());

        log.info("Appointment cancelled: id={}, reason={}", appointmentId, reason);
        return appointmentRepository.save(appointment);
    }

    // ========================================================================
    // MARK NO-SHOW
    // ========================================================================

    @Transactional
    public Appointment markNoShow(Integer appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        appointment.setStatus(AppointmentStatus.NO_SHOW);

        // Update patient no-show metrics (feeds back into prediction model)
        Patient patient = appointment.getPatient();
        patient.setNoshowCount(patient.getNoshowCount() + 1);
        if (patient.getTotalAppointments() > 0) {
            double newRate = (double) patient.getNoshowCount() / patient.getTotalAppointments();
            patient.setNoshowRate(BigDecimal.valueOf(newRate)
                    .setScale(2, java.math.RoundingMode.HALF_UP));
        }
        patientRepository.save(patient);

        // Release slot
        if (appointment.getSlot() != null) {
            appointment.getSlot().setSlotStatus(SlotStatus.AVAILABLE);
            timeSlotRepository.save(appointment.getSlot());
        }

        log.info("Marked no-show: appointment={}, patient noshow_rate now {}",
                appointmentId, patient.getNoshowRate());

        return appointmentRepository.save(appointment);
    }

    // ========================================================================
    // QUERY METHODS
    // ========================================================================

    @Transactional(readOnly = true)
    public Appointment getAppointment(Integer id) {
        return appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", id));
    }

    @Transactional(readOnly = true)
    public List<Appointment> getPatientAppointments(Integer patientId) {
        return appointmentRepository.findByPatient_PatientIdOrderByAppointmentDateDescStartTimeDesc(patientId);
    }

    @Transactional(readOnly = true)
    public List<Appointment> getDoctorAppointments(Integer doctorId, LocalDate date) {
        return appointmentRepository.findByDoctor_DoctorIdAndAppointmentDateOrderByStartTimeAsc(doctorId, date);
    }

    @Transactional(readOnly = true)
    public List<Appointment> getHighNoShowRisk(LocalDate fromDate, LocalDate toDate) {
        double threshold = predictionService.isHighNoShowRisk(null, null, 0) ? 0.5 : 0.5;
        return appointmentRepository.findHighNoShowRisk(fromDate, toDate,
                BigDecimal.valueOf(0.5));
    }

    // ========================================================================
    // LOAD BALANCING HELPER
    // ========================================================================

    private void updateDoctorLoad(Integer doctorId, LocalDate date) {
        DoctorLoad load = doctorLoadRepository.findByDoctor_DoctorIdAndLoadDate(doctorId, date)
                .orElseGet(() -> {
                    Doctor doctor = doctorRepository.findById(doctorId).orElse(null);
                    if (doctor == null) return null;
                    return DoctorLoad.builder()
                            .doctor(doctor)
                            .loadDate(date)
                            .build();
                });

        if (load == null) return;

        // Count booked slots for this doctor/date
        long bookedSlots = timeSlotRepository.countByDoctor_DoctorIdAndSlotDateAndSlotStatus(
                doctorId, date, SlotStatus.BOOKED);
        long totalSlots = timeSlotRepository
                .findByDoctor_DoctorIdAndSlotDateBetweenOrderBySlotDateAscStartTimeAsc(
                        doctorId, date, date).size();

        load.setBookedSlots((int) bookedSlots);
        load.setTotalSlots((int) totalSlots);

        if (totalSlots > 0) {
            double utilization = (double) bookedSlots / totalSlots * 100;
            load.setUtilizationPercentage(BigDecimal.valueOf(utilization)
                    .setScale(2, java.math.RoundingMode.HALF_UP));
        }

        doctorLoadRepository.save(load);
    }
}
