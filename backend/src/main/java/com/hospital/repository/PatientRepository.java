package com.hospital.repository;

import com.hospital.model.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PatientRepository extends JpaRepository<Patient, Integer> {

    /**
     * Hash Map O(1) lookup by unique patient UID.
     * The patient_uid column has a UNIQUE index in MySQL,
     * making this effectively a hash table lookup.
     *
     * DSA: Hash Map — O(1) patient verification at check-in.
     */
    Optional<Patient> findByPatientUidAndIsActiveTrue(String patientUid);

    Optional<Patient> findByPatientUid(String patientUid);

    Optional<Patient> findByPhone(String phone);

    Optional<Patient> findByEmail(String email);

    boolean existsByPatientUid(String patientUid);
}
