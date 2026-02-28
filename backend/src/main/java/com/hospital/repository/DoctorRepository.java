package com.hospital.repository;

import com.hospital.model.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, Integer> {

    List<Doctor> findByDepartment_DepartmentIdAndIsActiveTrue(Integer departmentId);

    List<Doctor> findByIsActiveTrue();

    List<Doctor> findBySpecializationContainingIgnoreCaseAndIsActiveTrue(String specialization);

    /**
     * Find doctors in a department ordered by their utilization (ascending).
     * Used by the Greedy Load Balancing algorithm to pick the least-loaded doctor.
     *
     * DSA: Greedy — always pick the doctor with minimum current load.
     */
    @Query("""
        SELECT d FROM Doctor d
        LEFT JOIN DoctorLoad dl ON d.doctorId = dl.doctor.doctorId AND dl.loadDate = :date
        WHERE d.department.departmentId = :deptId AND d.isActive = true
        ORDER BY COALESCE(dl.utilizationPercentage, 0) ASC
    """)
    List<Doctor> findByDepartmentOrderedByLoad(
            @Param("deptId") Integer departmentId,
            @Param("date") LocalDate date
    );
}
