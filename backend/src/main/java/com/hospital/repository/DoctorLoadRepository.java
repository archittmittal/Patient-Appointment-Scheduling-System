package com.hospital.repository;

import com.hospital.model.DoctorLoad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorLoadRepository extends JpaRepository<DoctorLoad, Integer> {

    Optional<DoctorLoad> findByDoctor_DoctorIdAndLoadDate(Integer doctorId, LocalDate date);

    /**
     * Get load distribution for all doctors on a date, ordered by utilization.
     * Used by the Greedy load balancing algorithm.
     */
    List<DoctorLoad> findByLoadDateOrderByUtilizationPercentageAsc(LocalDate date);
}
