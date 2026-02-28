package com.hospital.service;

import com.hospital.exception.InvalidOperationException;
import com.hospital.exception.ResourceNotFoundException;
import com.hospital.model.*;
import com.hospital.model.enums.AppointmentStatus;
import com.hospital.model.enums.QueueStatus;
import com.hospital.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Queue Service — Priority Queue (Min-Heap) implementation.
 *
 * DSA: Min-Heap based Priority Queue
 *
 * Heap Key Formula:
 *   priority_score = base_priority - (URGENCY_WEIGHT × urgency_level) - (WAIT_TIME_WEIGHT × wait_minutes)
 *   (Lower score = Higher priority)
 *
 * Operations:
 *   INSERT (check-in):    O(log n) — add patient, calculate priority, heapify
 *   EXTRACT-MIN (call):   O(log n) — remove highest-priority patient
 *   HEAPIFY (reorder):    O(n log n) — recalculate all priorities (wait time aging)
 *   EMERGENCY INSERT:     O(1) — override with priority_score = -100
 *
 * Wait Time Aging:
 *   Every minute a patient waits, their priority_score decreases by WAIT_TIME_WEIGHT.
 *   This ensures FIFO fairness within the same urgency level.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QueueService {

    private final LiveQueueRepository liveQueueRepository;
    private final AppointmentRepository appointmentRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final QueueHistoryRepository queueHistoryRepository;

    // Default algorithm weights (overridable from system_config)
    private static final double DEFAULT_URGENCY_WEIGHT = 10.0;
    private static final double DEFAULT_WAIT_TIME_WEIGHT = 0.5;
    private static final int DEFAULT_EMERGENCY_PRIORITY = -100;

    // ========================================================================
    // PRIORITY QUEUE OPERATION 1: INSERT (Check-in)
    // ========================================================================

    /**
     * Check in a patient — INSERT operation on the Min-Heap.
     *
     * Steps:
     * 1. Validate appointment exists and is in correct state
     * 2. Calculate initial priority score using the weighted formula
     * 3. Insert into the queue (heap)
     * 4. Trigger HEAPIFY to maintain heap property
     * 5. Return the queue entry with estimated wait time
     *
     * Time Complexity: O(n) for heapify, but practically fast with DB operations
     *
     * @param appointmentId Appointment to check in
     * @return LiveQueue entry with position and estimated wait
     */
    @Transactional
    public LiveQueue checkInPatient(Integer appointmentId) {
        // 1. Validate
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        if (liveQueueRepository.existsByAppointment_AppointmentId(appointmentId)) {
            throw new InvalidOperationException("Patient is already checked in for this appointment");
        }

        if (appointment.getStatus() != AppointmentStatus.SCHEDULED &&
            appointment.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new InvalidOperationException(
                    "Cannot check in: appointment status is " + appointment.getStatus());
        }

        // 2. Calculate initial priority score
        int basePriority = 100;
        int urgencyLevel = appointment.getUrgencyLevel();
        double priorityScore = calculatePriorityScore(basePriority, urgencyLevel, 0);

        // 3. Generate token number
        long queueSize = liveQueueRepository.countByDoctor_DoctorIdAndQueueStatus(
                appointment.getDoctor().getDoctorId(), QueueStatus.WAITING);
        String tokenNumber = generateToken(appointment.getDoctor().getDoctorId(), (int) queueSize + 1);

        // 4. INSERT into the priority queue
        LiveQueue queueEntry = LiveQueue.builder()
                .appointment(appointment)
                .doctor(appointment.getDoctor())
                .patient(appointment.getPatient())
                .queuePosition((int) queueSize + 1)
                .priorityScore(BigDecimal.valueOf(priorityScore))
                .basePriority(basePriority)
                .urgencyLevel(urgencyLevel)
                .checkinTime(LocalDateTime.now())
                .estimatedWaitMinutes(0) // Will be updated by prediction
                .queueStatus(QueueStatus.WAITING)
                .tokenNumber(tokenNumber)
                .build();

        LiveQueue saved = liveQueueRepository.save(queueEntry);

        // Update appointment status
        appointment.setStatus(AppointmentStatus.CHECKED_IN);
        appointment.setCheckinTime(LocalDateTime.now());
        appointmentRepository.save(appointment);

        // 5. HEAPIFY — reorder queue based on current priorities
        reorderQueue(appointment.getDoctor().getDoctorId());

        log.info("HEAP INSERT: patient {} checked in, priority_score={}, position={}, token={}",
                appointment.getPatient().getPatientId(), priorityScore,
                saved.getQueuePosition(), tokenNumber);

        return saved;
    }

    // ========================================================================
    // PRIORITY QUEUE OPERATION 2: EXTRACT-MIN (Call Next Patient)
    // ========================================================================

    /**
     * Call the next patient — EXTRACT-MIN operation on the Min-Heap.
     *
     * Min-Heap property: The root node has the MINIMUM key (priority_score).
     * Lower priority_score = Higher priority (will be called first).
     *
     * Steps:
     * 1. Reorder queue (recalculate with current wait times)
     * 2. Find the entry with MINIMUM priority_score (root of heap)
     * 3. Update status to CALLED
     * 4. Calculate actual wait time
     * 5. Reorder remaining queue
     *
     * Time Complexity: O(n) for reorder + O(1) for extract with DB ORDER BY
     *
     * @param doctorId Doctor calling the next patient
     * @return Called patient's queue entry, or null if queue is empty
     */
    @Transactional
    public LiveQueue callNextPatient(Integer doctorId) {
        // 1. HEAPIFY first — ensure priorities reflect current wait times
        reorderQueue(doctorId);

        // 2. EXTRACT-MIN — get the patient with lowest priority_score
        LiveQueue nextPatient = liveQueueRepository
                .findFirstByDoctor_DoctorIdAndQueueStatusOrderByPriorityScoreAsc(
                        doctorId, QueueStatus.WAITING)
                .orElse(null);

        if (nextPatient == null) {
            log.info("EXTRACT-MIN: Queue is empty for doctor {}", doctorId);
            return null;
        }

        // 3. Update status
        nextPatient.setQueueStatus(QueueStatus.CALLED);
        nextPatient.setCalledAt(LocalDateTime.now());

        // 4. Calculate actual wait time
        long waitMinutes = Duration.between(nextPatient.getCheckinTime(), LocalDateTime.now()).toMinutes();
        nextPatient.setActualWaitMinutes((int) waitMinutes);

        liveQueueRepository.save(nextPatient);

        // Update appointment status
        Appointment appointment = nextPatient.getAppointment();
        appointment.setStatus(AppointmentStatus.IN_PROGRESS);
        appointment.setConsultationStart(LocalDateTime.now());
        appointment.setActualWaitTime((int) waitMinutes);
        appointmentRepository.save(appointment);

        // 5. Reorder remaining queue
        reorderQueue(doctorId);

        log.info("EXTRACT-MIN: patient {} called, priority_score={}, waited {} mins",
                nextPatient.getPatient().getPatientId(),
                nextPatient.getPriorityScore(), waitMinutes);

        return nextPatient;
    }

    // ========================================================================
    // PRIORITY QUEUE OPERATION 3: EMERGENCY INSERT
    // ========================================================================

    /**
     * Emergency check-in — INSERT with priority override.
     *
     * Sets priority_score to EMERGENCY_PRIORITY (-100), guaranteeing
     * the patient will be at position 1 after the next heapify.
     * This is a special case of heap insert where the key is forced to minimum.
     *
     * @param appointmentId Emergency appointment ID
     * @return Queue entry at position 1
     */
    @Transactional
    public LiveQueue insertEmergency(Integer appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", appointmentId));

        if (liveQueueRepository.existsByAppointment_AppointmentId(appointmentId)) {
            throw new InvalidOperationException("Patient is already in the queue");
        }

        int emergencyPriority = getConfigInt("EMERGENCY_PRIORITY", DEFAULT_EMERGENCY_PRIORITY);

        LiveQueue queueEntry = LiveQueue.builder()
                .appointment(appointment)
                .doctor(appointment.getDoctor())
                .patient(appointment.getPatient())
                .queuePosition(1)  // Will be confirmed by heapify
                .priorityScore(BigDecimal.valueOf(emergencyPriority))
                .basePriority(emergencyPriority)
                .urgencyLevel(5) // Maximum urgency
                .checkinTime(LocalDateTime.now())
                .estimatedWaitMinutes(0) // Emergency = immediate
                .queueStatus(QueueStatus.WAITING)
                .tokenNumber("E-" + System.currentTimeMillis() % 1000)
                .build();

        liveQueueRepository.save(queueEntry);

        appointment.setStatus(AppointmentStatus.CHECKED_IN);
        appointment.setCheckinTime(LocalDateTime.now());
        appointment.setUrgencyLevel(5);
        appointmentRepository.save(appointment);

        // Heapify to place emergency patient at root
        reorderQueue(appointment.getDoctor().getDoctorId());

        log.warn("EMERGENCY INSERT: patient {} priority_score={}, position=1",
                appointment.getPatient().getPatientId(), emergencyPriority);

        return queueEntry;
    }

    // ========================================================================
    // PRIORITY QUEUE OPERATION 4: HEAPIFY (Reorder Queue)
    // ========================================================================

    /**
     * Reorder the entire queue — HEAPIFY operation.
     *
     * This operation recalculates all priority scores based on CURRENT wait times,
     * then reassigns queue positions. It's equivalent to building a new heap.
     *
     * The wait-time aging ensures that even low-urgency patients eventually
     * rise to the top of the queue (starvation prevention).
     *
     * Priority Score Formula:
     *   score = base_priority - (urgency_weight × urgency) - (wait_weight × minutes_waited)
     *
     * Lower score ⟹ Higher priority ⟹ Called sooner
     *
     * Time Complexity: O(n log n) due to implicit sort by priority_score
     */
    @Transactional
    public void reorderQueue(Integer doctorId) {
        List<LiveQueue> waitingPatients = liveQueueRepository
                .findByDoctor_DoctorIdAndQueueStatusOrderByPriorityScoreAsc(
                        doctorId, QueueStatus.WAITING);

        if (waitingPatients.isEmpty()) return;

        double urgencyWeight = getConfigDouble("URGENCY_WEIGHT", DEFAULT_URGENCY_WEIGHT);
        double waitTimeWeight = getConfigDouble("WAIT_TIME_WEIGHT", DEFAULT_WAIT_TIME_WEIGHT);

        // Recalculate priority scores with current wait times
        for (LiveQueue entry : waitingPatients) {
            long minutesWaited = Duration.between(entry.getCheckinTime(), LocalDateTime.now()).toMinutes();
            double newScore = calculatePriorityScore(
                    entry.getBasePriority(), entry.getUrgencyLevel(), (int) minutesWaited);
            entry.setPriorityScore(BigDecimal.valueOf(newScore).setScale(2, RoundingMode.HALF_UP));
        }

        // Sort by priority score (Min-Heap order)
        waitingPatients.sort((a, b) -> a.getPriorityScore().compareTo(b.getPriorityScore()));

        // Reassign positions
        AtomicInteger position = new AtomicInteger(1);
        for (LiveQueue entry : waitingPatients) {
            entry.setQueuePosition(position.getAndIncrement());
        }

        liveQueueRepository.saveAll(waitingPatients);

        log.debug("HEAPIFY: Reordered {} patients for doctor {}", waitingPatients.size(), doctorId);
    }

    // ========================================================================
    // COMPLETE CONSULTATION
    // ========================================================================

    /**
     * Mark consultation as completed and record metrics for DP model training.
     */
    @Transactional
    public void completeConsultation(Integer queueId) {
        LiveQueue queueEntry = liveQueueRepository.findById(queueId)
                .orElseThrow(() -> new ResourceNotFoundException("Queue entry", "id", queueId));

        queueEntry.setQueueStatus(QueueStatus.COMPLETED);
        liveQueueRepository.save(queueEntry);

        Appointment appointment = queueEntry.getAppointment();
        appointment.setStatus(AppointmentStatus.COMPLETED);
        appointment.setConsultationEnd(LocalDateTime.now());

        if (appointment.getConsultationStart() != null) {
            long consultMinutes = Duration.between(
                    appointment.getConsultationStart(), LocalDateTime.now()).toMinutes();
            appointment.setActualConsultationTime((int) consultMinutes);
        }

        appointmentRepository.save(appointment);

        // Record to queue_history for DP prediction training
        recordToHistory(queueEntry, appointment);

        log.info("Consultation completed: patient {}, waited {} mins, consultation {} mins",
                appointment.getPatient().getPatientId(),
                queueEntry.getActualWaitMinutes(),
                appointment.getActualConsultationTime());
    }

    // ========================================================================
    // GET CURRENT QUEUE STATE
    // ========================================================================

    /**
     * Get the current live queue for a doctor, ordered by priority.
     * Returns the heap contents in Min-Heap order.
     */
    @Transactional(readOnly = true)
    public List<LiveQueue> getLiveQueue(Integer doctorId) {
        return liveQueueRepository.findByDoctor_DoctorIdAndQueueStatusOrderByPriorityScoreAsc(
                doctorId, QueueStatus.WAITING);
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    /**
     * Calculate priority score using the weighted formula.
     *
     * Formula: base_priority - (urgency_weight × urgency) - (wait_weight × wait_minutes)
     *
     * Examples:
     *   Normal patient, just arrived:   100 - (10×1) - (0.5×0)  = 90.0
     *   Urgent patient, just arrived:   100 - (10×5) - (0.5×0)  = 50.0
     *   Normal patient, waited 30 min:  100 - (10×1) - (0.5×30) = 75.0
     *   Emergency override:             -100 (hardcoded)
     */
    private double calculatePriorityScore(int basePriority, int urgencyLevel, int waitMinutes) {
        double urgencyWeight = getConfigDouble("URGENCY_WEIGHT", DEFAULT_URGENCY_WEIGHT);
        double waitTimeWeight = getConfigDouble("WAIT_TIME_WEIGHT", DEFAULT_WAIT_TIME_WEIGHT);

        return basePriority - (urgencyWeight * urgencyLevel) - (waitTimeWeight * waitMinutes);
    }

    /**
     * Record completed consultation to queue_history table.
     * This data trains the DP prediction model.
     */
    private void recordToHistory(LiveQueue queueEntry, Appointment appointment) {
        QueueHistory history = QueueHistory.builder()
                .doctor(queueEntry.getDoctor())
                .appointmentId(appointment.getAppointmentId())
                .patientId(appointment.getPatient().getPatientId())
                .queueDate(appointment.getAppointmentDate())
                .dayOfWeek(com.hospital.model.enums.DayOfWeek.valueOf(
                        appointment.getAppointmentDate().getDayOfWeek().name()))
                .hourOfDay(appointment.getStartTime().getHour())
                .appointmentType(appointment.getAppointmentType())
                .waitTimeMinutes(queueEntry.getActualWaitMinutes() != null ?
                        queueEntry.getActualWaitMinutes() : 0)
                .consultationMinutes(appointment.getActualConsultationTime() != null ?
                        appointment.getActualConsultationTime() : 15)
                .queueSizeAtCheckin(queueEntry.getQueuePosition())
                .wasNoshow(false)
                .build();

        queueHistoryRepository.save(history);
    }

    private String generateToken(Integer doctorId, int position) {
        return "D" + doctorId + "-" + String.format("%03d", position);
    }

    private double getConfigDouble(String key, double defaultValue) {
        return systemConfigRepository.findByConfigKey(key)
                .map(c -> Double.parseDouble(c.getConfigValue()))
                .orElse(defaultValue);
    }

    private int getConfigInt(String key, int defaultValue) {
        return systemConfigRepository.findByConfigKey(key)
                .map(c -> Integer.parseInt(c.getConfigValue()))
                .orElse(defaultValue);
    }
}
