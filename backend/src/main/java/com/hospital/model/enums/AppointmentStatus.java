package com.hospital.model.enums;

/** Appointment lifecycle status. Maps to: appointments.status ENUM */
public enum AppointmentStatus {
    SCHEDULED, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW
}
