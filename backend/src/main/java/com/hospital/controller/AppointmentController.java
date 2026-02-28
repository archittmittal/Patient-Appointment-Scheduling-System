package com.hospital.controller;

import com.hospital.dto.request.BookAppointmentRequest;
import com.hospital.dto.response.AppointmentResponse;
import com.hospital.model.Appointment;
import com.hospital.service.AppointmentService;
import com.hospital.service.PredictionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Appointment REST Controller.
 *
 * Exposes the integrated DSA pipeline:
 * Hash Map lookup → Greedy slot selection → Interval conflict check → No-show prediction
 *
 * Novel API: Supports 3 booking modes:
 * 1. Manual: Specify exact doctor + time slot
 * 2. Auto-Greedy: Specify doctor, system picks earliest slot (Activity Selection)
 * 3. Load-Balanced: Specify department, system picks best doctor + slot (Two-level Greedy)
 */
@RestController
@RequestMapping("/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentService appointmentService;

    // ── BOOKING ENDPOINTS (3 DSA modes) ──────────────────────────────────

    /**
     * Smart booking — automatically selects the best mode.
     * If startTime provided → manual booking
     * If doctorId + no startTime → auto-greedy
     * If departmentId + no doctorId → load-balanced
     */
    @PostMapping("/book")
    public ResponseEntity<AppointmentResponse> bookAppointment(
            @Valid @RequestBody BookAppointmentRequest request) {

        Appointment appointment;

        if (request.startTime() != null && request.endTime() != null && request.doctorId() != null) {
            // Mode 1: Manual — exact slot specified
            appointment = appointmentService.bookAppointment(
                    request.patientId(), request.doctorId(),
                    request.date(), request.startTime(), request.endTime(),
                    request.reasonForVisit());

        } else if (request.doctorId() != null) {
            // Mode 2: Auto-Greedy — system picks earliest available slot
            appointment = appointmentService.bookWithAutoScheduling(
                    request.patientId(), request.doctorId(),
                    request.date(), request.durationMinutes(),
                    request.reasonForVisit());

        } else if (request.departmentId() != null) {
            // Mode 3: Load-Balanced — system picks best doctor + slot
            appointment = appointmentService.bookWithLoadBalancing(
                    request.patientId(), request.departmentId(),
                    request.date(), request.durationMinutes(),
                    request.reasonForVisit());

        } else {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(appointment));
    }

    // ── QUERY ENDPOINTS ──────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<AppointmentResponse> getAppointment(@PathVariable Integer id) {
        return ResponseEntity.ok(toResponse(appointmentService.getAppointment(id)));
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<AppointmentResponse>> getPatientAppointments(
            @PathVariable Integer patientId) {
        return ResponseEntity.ok(
                appointmentService.getPatientAppointments(patientId).stream()
                        .map(this::toResponse).toList());
    }

    @GetMapping("/doctor/{doctorId}")
    public ResponseEntity<List<AppointmentResponse>> getDoctorAppointments(
            @PathVariable Integer doctorId,
            @RequestParam(defaultValue = "#{T(java.time.LocalDate).now()}") String date) {
        return ResponseEntity.ok(
                appointmentService.getDoctorAppointments(doctorId, LocalDate.parse(date)).stream()
                        .map(this::toResponse).toList());
    }

    // ── STATUS CHANGE ENDPOINTS ──────────────────────────────────────────

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<AppointmentResponse> cancelAppointment(
            @PathVariable Integer id,
            @RequestParam(defaultValue = "Patient requested") String reason) {
        return ResponseEntity.ok(toResponse(appointmentService.cancelAppointment(id, reason)));
    }

    @PatchMapping("/{id}/no-show")
    public ResponseEntity<AppointmentResponse> markNoShow(@PathVariable Integer id) {
        return ResponseEntity.ok(toResponse(appointmentService.markNoShow(id)));
    }

    // ── HIGH-RISK QUERY (No-show prediction output) ──────────────────────

    @GetMapping("/high-risk")
    public ResponseEntity<List<AppointmentResponse>> getHighNoShowRisk(
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate) {
        LocalDate from = fromDate != null ? LocalDate.parse(fromDate) : LocalDate.now();
        LocalDate to = toDate != null ? LocalDate.parse(toDate) : from.plusDays(7);
        return ResponseEntity.ok(
                appointmentService.getHighNoShowRisk(from, to).stream()
                        .map(this::toResponse).toList());
    }

    // ── DTO MAPPER ───────────────────────────────────────────────────────

    private AppointmentResponse toResponse(Appointment a) {
        return new AppointmentResponse(
                a.getAppointmentId(),
                a.getPatient().getPatientId(),
                a.getPatient().getFullName(),
                a.getDoctor().getDoctorId(),
                a.getDoctor().getFullName(),
                a.getDoctor().getDepartment().getDepartmentName(),
                a.getAppointmentDate(),
                a.getStartTime(),
                a.getEndTime(),
                a.getAppointmentType().name(),
                a.getStatus().name(),
                a.getPriorityLevel(),
                a.getUrgencyLevel(),
                a.getExpectedDuration(),
                a.getCaseComplexity().name(),
                a.getNoshowProbability(),
                a.getReminderSent(),
                a.getReasonForVisit(),
                null // token set when patient checks in
        );
    }
}
