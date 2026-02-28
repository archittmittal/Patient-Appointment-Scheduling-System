package com.hospital.repository;

import com.hospital.model.DoctorSchedule;
import com.hospital.model.enums.DayOfWeek;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DoctorScheduleRepository extends JpaRepository<DoctorSchedule, Integer> {

    List<DoctorSchedule> findByDoctor_DoctorIdAndIsAvailableTrue(Integer doctorId);

    Optional<DoctorSchedule> findByDoctor_DoctorIdAndDayOfWeekAndIsAvailableTrue(
            Integer doctorId, DayOfWeek dayOfWeek);

    List<DoctorSchedule> findByDoctor_DoctorId(Integer doctorId);
}
