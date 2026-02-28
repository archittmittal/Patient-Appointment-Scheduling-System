package com.hospital.service;

import com.hospital.exception.ResourceNotFoundException;
import com.hospital.model.Patient;
import com.hospital.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Patient Service — includes hash-based O(1) UID verification.
 *
 * DSA: Hash Map — patient_uid column has a UNIQUE index, making
 * lookups equivalent to a hash table get(key) operation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PatientService {

    private final PatientRepository patientRepository;

    /**
     * Verify patient by UID — Hash Map O(1) lookup.
     * Used at check-in kiosk for instant identity verification.
     */
    @Transactional(readOnly = true)
    public Patient verifyByUid(String patientUid) {
        return patientRepository.findByPatientUidAndIsActiveTrue(patientUid)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Patient", "UID", patientUid));
    }

    @Transactional
    public Patient createPatient(Patient patient) {
        if (patientRepository.existsByPatientUid(patient.getPatientUid())) {
            throw new com.hospital.exception.InvalidOperationException(
                    "Patient UID already exists: " + patient.getPatientUid());
        }
        return patientRepository.save(patient);
    }

    @Transactional
    public Patient updatePatient(Integer patientId, Patient updates) {
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new ResourceNotFoundException("Patient", "id", patientId));

        if (updates.getFirstName() != null) patient.setFirstName(updates.getFirstName());
        if (updates.getLastName() != null) patient.setLastName(updates.getLastName());
        if (updates.getPhone() != null) patient.setPhone(updates.getPhone());
        if (updates.getEmail() != null) patient.setEmail(updates.getEmail());
        if (updates.getAddress() != null) patient.setAddress(updates.getAddress());
        if (updates.getEmergencyContact() != null) patient.setEmergencyContact(updates.getEmergencyContact());
        if (updates.getBloodGroup() != null) patient.setBloodGroup(updates.getBloodGroup());
        if (updates.getMedicalHistory() != null) patient.setMedicalHistory(updates.getMedicalHistory());

        return patientRepository.save(patient);
    }

    @Transactional(readOnly = true)
    public Patient getPatient(Integer id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient", "id", id));
    }

    @Transactional(readOnly = true)
    public List<Patient> getAllPatients() {
        return patientRepository.findAll();
    }
}
