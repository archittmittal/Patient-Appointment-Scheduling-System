package com.hospital.controller;

import com.hospital.dto.request.PatientRequest;
import com.hospital.model.Patient;
import com.hospital.model.enums.Gender;
import com.hospital.service.PatientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Patient REST Controller.
 *
 * Features Hash Map O(1) UID verification endpoint.
 */
@RestController
@RequestMapping("/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService patientService;

    // ── CREATE ────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<Patient> createPatient(@Valid @RequestBody PatientRequest request) {
        Patient patient = Patient.builder()
                .firstName(request.firstName())
                .lastName(request.lastName())
                .phone(request.phone())
                .email(request.email())
                .dateOfBirth(request.dateOfBirth() != null ? LocalDate.parse(request.dateOfBirth()) : null)
                .gender(request.gender() != null ? Gender.valueOf(request.gender()) : Gender.OTHER)
                .address(request.address())
                .emergencyContact(request.emergencyContact())
                .bloodGroup(request.bloodGroup())
                .medicalHistory(request.medicalHistory())
                .patientUid(UUID.randomUUID().toString().substring(0, 12).toUpperCase())
                .build();

        return ResponseEntity.status(HttpStatus.CREATED).body(patientService.createPatient(patient));
    }

    // ── READ ──────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<Patient> getPatient(@PathVariable Integer id) {
        return ResponseEntity.ok(patientService.getPatient(id));
    }

    @GetMapping
    public ResponseEntity<List<Patient>> getAllPatients() {
        return ResponseEntity.ok(patientService.getAllPatients());
    }

    // ── UPDATE ────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<Patient> updatePatient(
            @PathVariable Integer id,
            @Valid @RequestBody PatientRequest request) {
        Patient updates = Patient.builder()
                .firstName(request.firstName())
                .lastName(request.lastName())
                .phone(request.phone())
                .email(request.email())
                .address(request.address())
                .emergencyContact(request.emergencyContact())
                .bloodGroup(request.bloodGroup())
                .medicalHistory(request.medicalHistory())
                .build();
        return ResponseEntity.ok(patientService.updatePatient(id, updates));
    }

    // ── HASH MAP O(1) UID VERIFICATION ───────────────────────────────────

    /**
     * Verify patient identity by UID — used at check-in kiosk.
     * DSA: Hash Map O(1) lookup via UNIQUE index on patient_uid.
     */
    @GetMapping("/verify/{uid}")
    public ResponseEntity<Map<String, Object>> verifyByUid(@PathVariable String uid) {
        Patient patient = patientService.verifyByUid(uid);
        return ResponseEntity.ok(Map.of(
                "verified", true,
                "algorithm", "Hash Map O(1) lookup (UNIQUE index on patient_uid)",
                "patient", Map.of(
                        "patientId", patient.getPatientId(),
                        "name", patient.getFullName(),
                        "uid", patient.getPatientUid(),
                        "noshowRate", patient.getNoshowRate()
                )
        ));
    }
}
