package com.hospital.controller;

import com.hospital.dto.response.QueueEntryResponse;
import com.hospital.model.LiveQueue;
import com.hospital.service.QueueService;
import com.hospital.service.PredictionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Queue REST Controller — exposes the Priority Queue (Min-Heap) operations.
 *
 * Novel approach: Each endpoint maps directly to a heap operation:
 * - POST /check-in      → HEAP INSERT
 * - POST /call-next      → HEAP EXTRACT-MIN
 * - POST /emergency      → EMERGENCY INSERT (priority override)
 * - POST /reorder        → HEAPIFY (explicit reorder)
 * - POST /complete       → Remove + record to DP training data
 * - GET  /live           → View full heap contents
 */
@RestController
@RequestMapping("/queue")
@RequiredArgsConstructor
public class QueueController {

    private final QueueService queueService;
    private final PredictionService predictionService;

    // ── HEAP INSERT — Check in a patient ─────────────────────────────────

    @PostMapping("/check-in/{appointmentId}")
    public ResponseEntity<QueueEntryResponse> checkIn(@PathVariable Integer appointmentId) {
        LiveQueue entry = queueService.checkInPatient(appointmentId);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(entry));
    }

    // ── HEAP EXTRACT-MIN — Call next patient ─────────────────────────────

    @PostMapping("/call-next/{doctorId}")
    public ResponseEntity<QueueEntryResponse> callNext(@PathVariable Integer doctorId) {
        LiveQueue next = queueService.callNextPatient(doctorId);
        if (next == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(toResponse(next));
    }

    // ── EMERGENCY INSERT — Priority override ─────────────────────────────

    @PostMapping("/emergency/{appointmentId}")
    public ResponseEntity<QueueEntryResponse> emergencyInsert(@PathVariable Integer appointmentId) {
        LiveQueue entry = queueService.insertEmergency(appointmentId);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(entry));
    }

    // ── COMPLETE CONSULTATION — Remove from heap + train DP model ────────

    @PostMapping("/complete/{queueId}")
    public ResponseEntity<Map<String, String>> completeConsultation(@PathVariable Integer queueId) {
        queueService.completeConsultation(queueId);
        return ResponseEntity.ok(Map.of(
                "status", "completed",
                "message", "Consultation completed. Data recorded to DP prediction model."
        ));
    }

    // ── HEAPIFY — Explicit queue reorder ─────────────────────────────────

    @PostMapping("/reorder/{doctorId}")
    public ResponseEntity<List<QueueEntryResponse>> reorderQueue(@PathVariable Integer doctorId) {
        queueService.reorderQueue(doctorId);
        List<LiveQueue> reordered = queueService.getLiveQueue(doctorId);
        return ResponseEntity.ok(reordered.stream().map(this::toResponse).toList());
    }

    // ── VIEW HEAP CONTENTS — Full live queue ─────────────────────────────

    @GetMapping("/live/{doctorId}")
    public ResponseEntity<List<QueueEntryResponse>> getLiveQueue(@PathVariable Integer doctorId) {
        List<LiveQueue> queue = queueService.getLiveQueue(doctorId);
        return ResponseEntity.ok(queue.stream().map(this::toResponse).toList());
    }

    // ── QUEUE STATS ──────────────────────────────────────────────────────

    @GetMapping("/stats/{doctorId}")
    public ResponseEntity<Map<String, Object>> getQueueStats(@PathVariable Integer doctorId) {
        List<LiveQueue> queue = queueService.getLiveQueue(doctorId);
        int avgWait = queue.isEmpty() ? 0 :
                (int) queue.stream().mapToInt(LiveQueue::getEstimatedWaitMinutes).average().orElse(0);

        return ResponseEntity.ok(Map.of(
                "doctorId", doctorId,
                "queueSize", queue.size(),
                "averageEstimatedWait", avgWait,
                "priorityQueueAlgorithm", "Min-Heap (lower score = higher priority)"
        ));
    }

    // ── DTO MAPPER ───────────────────────────────────────────────────────

    private QueueEntryResponse toResponse(LiveQueue q) {
        return new QueueEntryResponse(
                q.getQueueId(),
                q.getAppointment().getAppointmentId(),
                q.getPatient().getPatientId(),
                q.getPatient().getFullName(),
                q.getDoctor().getDoctorId(),
                q.getDoctor().getFullName(),
                q.getQueuePosition(),
                q.getPriorityScore(),
                q.getUrgencyLevel(),
                q.getCheckinTime(),
                q.getEstimatedWaitMinutes(),
                q.getActualWaitMinutes(),
                q.getQueueStatus().name(),
                q.getTokenNumber(),
                q.getCalledAt()
        );
    }
}
