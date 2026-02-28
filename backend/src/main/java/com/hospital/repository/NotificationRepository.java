package com.hospital.repository;

import com.hospital.model.Notification;
import com.hospital.model.enums.NotificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Integer> {

    List<Notification> findByPatient_PatientIdOrderByCreatedAtDesc(Integer patientId);

    List<Notification> findByStatusAndScheduledTimeLessThanEqual(
            NotificationStatus status, LocalDateTime dateTime);

    List<Notification> findByAppointment_AppointmentId(Integer appointmentId);
}
