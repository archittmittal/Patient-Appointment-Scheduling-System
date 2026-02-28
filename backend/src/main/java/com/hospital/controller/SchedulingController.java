package com.hospital.controller;

import com.hospital.dto.response.SlotResponse;
import com.hospital.model.TimeSlot;
import com.hospital.model.DoctorLoad;
import com.hospital.model.enums.SlotStatus;
import com.hospital.repository.DoctorLoadRepository;
import com.hospital.service.SchedulingService;
import com.hospital.repository.TimeSlotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Scheduling REST Controller — exposes Greedy Algorithm operations.
 *
 * Novel feature: Transparent algorithm choice
 * - /available → basic availability listing
 * - /optimal → Greedy Activity Selection (first-fit)
 * - /balanced → Two-level Greedy (min utilization + first-fit)
 * - /generate → Slot pre-computation with buffer allocation
 */
@RestController
@RequestMapping("/scheduling")
@RequiredArgsConstructor
public class SchedulingController {

    private final SchedulingService schedulingService;
    private final TimeSlotRepository timeSlotRepository;
    private final DoctorLoadRepository doctorLoadRepository;

    // ── AVAILABLE SLOTS ──────────────────────────────────────────────────

    @GetMapping("/available/{doctorId}")
    public ResponseEntity<List<SlotResponse>> getAvailableSlots(
            @PathVariable Integer doctorId,
            @RequestParam String date) {
        List<TimeSlot> slots = timeSlotRepository
                .findByDoctor_DoctorIdAndSlotDateAndSlotStatusOrderByStartTimeAsc(
                        doctorId, LocalDate.parse(date), SlotStatus.AVAILABLE);
        return ResponseEntity.ok(slots.stream().map(this::toResponse).toList());
    }

    // ── GREEDY OPTIMAL SLOT (Activity Selection) ─────────────────────────

    @GetMapping("/optimal/{doctorId}")
    public ResponseEntity<Map<String, Object>> findOptimalSlot(
            @PathVariable Integer doctorId,
            @RequestParam String date,
            @RequestParam(defaultValue = "20") int duration) {

        TimeSlot optimal = schedulingService.findOptimalSlot(
                doctorId, LocalDate.parse(date), duration);

        if (optimal == null) {
            return ResponseEntity.ok(Map.of(
                    "found", false,
                    "algorithm", "Greedy Activity Selection (First-Fit)",
                    "message", "No available slots matching criteria"));
        }

        return ResponseEntity.ok(Map.of(
                "found", true,
                "algorithm", "Greedy Activity Selection (First-Fit)",
                "greedyChoice", "Earliest available slot that fits the duration requirement",
                "timeComplexity", "O(1) with database index, O(n) worst case",
                "slot", toResponse(optimal)));
    }

    // ── LOAD BALANCED SLOT (Two-level Greedy) ────────────────────────────

    @GetMapping("/balanced/{departmentId}")
    public ResponseEntity<Map<String, Object>> findLoadBalancedSlot(
            @PathVariable Integer departmentId,
            @RequestParam String date,
            @RequestParam(defaultValue = "20") int duration) {

        TimeSlot balanced = schedulingService.findLoadBalancedSlot(
                departmentId, LocalDate.parse(date), duration);

        if (balanced == null) {
            return ResponseEntity.ok(Map.of(
                    "found", false,
                    "algorithm", "Two-level Greedy (Load Balance + Activity Selection)",
                    "message", "No available slots in department"));
        }

        // Get utilization info for the selected doctor
        BigDecimal utilization = doctorLoadRepository
                .findByDoctor_DoctorIdAndLoadDate(
                        balanced.getDoctor().getDoctorId(), LocalDate.parse(date))
                .map(DoctorLoad::getUtilizationPercentage)
                .orElse(BigDecimal.ZERO);

        return ResponseEntity.ok(Map.of(
                "found", true,
                "algorithm", "Two-level Greedy (Load Balance + Activity Selection)",
                "level1", "Select doctor with minimum utilization (" + utilization + "%)",
                "level2", "Select earliest available slot for that doctor",
                "slot", toResponse(balanced)));
    }

    // ── CONFLICT CHECK (Interval Scheduling) ─────────────────────────────

    @GetMapping("/conflict-check")
    public ResponseEntity<Map<String, Object>> checkConflict(
            @RequestParam Integer doctorId,
            @RequestParam String date,
            @RequestParam String startTime,
            @RequestParam String endTime) {

        boolean hasConflict = schedulingService.hasConflict(
                doctorId, LocalDate.parse(date),
                java.time.LocalTime.parse(startTime),
                java.time.LocalTime.parse(endTime), null);

        return ResponseEntity.ok(Map.of(
                "hasConflict", hasConflict,
                "algorithm", "Interval Scheduling (Overlap Detection)",
                "rule", "Two intervals [s1,e1) [s2,e2) overlap iff s1 < e2 AND s2 < e1",
                "doctorId", doctorId,
                "requestedInterval", startTime + " - " + endTime));
    }

    // ── SLOT GENERATION ──────────────────────────────────────────────────

    @PostMapping("/generate-slots/{doctorId}")
    public ResponseEntity<Map<String, Object>> generateSlots(
            @PathVariable Integer doctorId,
            @RequestParam String startDate,
            @RequestParam String endDate) {

        int count = schedulingService.generateTimeSlots(
                doctorId, LocalDate.parse(startDate), LocalDate.parse(endDate));

        return ResponseEntity.ok(Map.of(
                "slotsGenerated", count,
                "algorithm", "Greedy Buffer Allocation",
                "description", "Slots generated with buffer time between appointments",
                "doctorId", doctorId,
                "dateRange", startDate + " to " + endDate));
    }

    // ── DTO MAPPER ───────────────────────────────────────────────────────

    private SlotResponse toResponse(TimeSlot ts) {
        BigDecimal utilization = doctorLoadRepository
                .findByDoctor_DoctorIdAndLoadDate(ts.getDoctor().getDoctorId(), ts.getSlotDate())
                .map(DoctorLoad::getUtilizationPercentage)
                .orElse(BigDecimal.ZERO);

        return new SlotResponse(
                ts.getSlotId(),
                ts.getDoctor().getDoctorId(),
                ts.getDoctor().getFullName(),
                ts.getDoctor().getDepartment().getDepartmentName(),
                ts.getSlotDate(),
                ts.getStartTime(),
                ts.getEndTime(),
                ts.getSlotDuration(),
                ts.getSlotStatus().name(),
                utilization);
    }
}
