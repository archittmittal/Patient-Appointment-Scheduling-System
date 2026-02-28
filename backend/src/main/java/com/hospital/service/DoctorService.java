package com.hospital.service;

import com.hospital.exception.ResourceNotFoundException;
import com.hospital.model.Department;
import com.hospital.model.Doctor;
import com.hospital.model.DoctorSchedule;
import com.hospital.repository.DepartmentRepository;
import com.hospital.repository.DoctorRepository;
import com.hospital.repository.DoctorScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Doctor Service — CRUD + load-balanced doctor lookup.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DoctorService {

    private final DoctorRepository doctorRepository;
    private final DepartmentRepository departmentRepository;
    private final DoctorScheduleRepository scheduleRepository;

    @Transactional(readOnly = true)
    public Doctor getDoctor(Integer id) {
        return doctorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", "id", id));
    }

    @Transactional(readOnly = true)
    public List<Doctor> getAllDoctors() {
        return doctorRepository.findByIsActiveTrue();
    }

    @Transactional(readOnly = true)
    public List<Doctor> getDoctorsByDepartment(Integer departmentId) {
        return doctorRepository.findByDepartment_DepartmentIdAndIsActiveTrue(departmentId);
    }

    /**
     * Get doctors in a department, ordered by load (least loaded first).
     * DSA: Greedy load balancing ordering.
     */
    @Transactional(readOnly = true)
    public List<Doctor> getDoctorsOrderedByLoad(Integer departmentId, LocalDate date) {
        return doctorRepository.findByDepartmentOrderedByLoad(departmentId, date);
    }

    @Transactional(readOnly = true)
    public List<Doctor> searchDoctors(String specialization) {
        return doctorRepository.findBySpecializationContainingIgnoreCaseAndIsActiveTrue(specialization);
    }

    @Transactional(readOnly = true)
    public List<DoctorSchedule> getDoctorSchedule(Integer doctorId) {
        return scheduleRepository.findByDoctor_DoctorId(doctorId);
    }

    @Transactional(readOnly = true)
    public List<Department> getAllDepartments() {
        return departmentRepository.findByIsActiveTrue();
    }

    @Transactional(readOnly = true)
    public Department getDepartment(Integer id) {
        return departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", id));
    }
}
