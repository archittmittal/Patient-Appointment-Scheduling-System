package com.hospital.controller;

import com.hospital.model.Department;
import com.hospital.model.Doctor;
import com.hospital.model.DoctorSchedule;
import com.hospital.service.DoctorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Doctor REST Controller — CRUD + load-balanced doctor lookup.
 */
@RestController
@RequestMapping("/doctors")
@RequiredArgsConstructor
public class DoctorController {

    private final DoctorService doctorService;

    @GetMapping
    public ResponseEntity<List<Doctor>> getAllDoctors() {
        return ResponseEntity.ok(doctorService.getAllDoctors());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Doctor> getDoctor(@PathVariable Integer id) {
        return ResponseEntity.ok(doctorService.getDoctor(id));
    }

    @GetMapping("/department/{departmentId}")
    public ResponseEntity<List<Doctor>> getDoctorsByDepartment(
            @PathVariable Integer departmentId) {
        return ResponseEntity.ok(doctorService.getDoctorsByDepartment(departmentId));
    }

    /**
     * Get doctors ordered by load — supports Greedy load balancing.
     * The first doctor in the response is the least loaded = best choice.
     */
    @GetMapping("/department/{departmentId}/load-balanced")
    public ResponseEntity<List<Doctor>> getDoctorsByLoad(
            @PathVariable Integer departmentId,
            @RequestParam(required = false) String date) {
        LocalDate queryDate = date != null ? LocalDate.parse(date) : LocalDate.now();
        return ResponseEntity.ok(doctorService.getDoctorsOrderedByLoad(departmentId, queryDate));
    }

    @GetMapping("/search")
    public ResponseEntity<List<Doctor>> searchDoctors(@RequestParam String specialization) {
        return ResponseEntity.ok(doctorService.searchDoctors(specialization));
    }

    @GetMapping("/{id}/schedule")
    public ResponseEntity<List<DoctorSchedule>> getDoctorSchedule(@PathVariable Integer id) {
        return ResponseEntity.ok(doctorService.getDoctorSchedule(id));
    }

    // ── DEPARTMENT ENDPOINTS ─────────────────────────────────────────────

    @GetMapping("/departments")
    public ResponseEntity<List<Department>> getAllDepartments() {
        return ResponseEntity.ok(doctorService.getAllDepartments());
    }

    @GetMapping("/departments/{id}")
    public ResponseEntity<Department> getDepartment(@PathVariable Integer id) {
        return ResponseEntity.ok(doctorService.getDepartment(id));
    }
}
