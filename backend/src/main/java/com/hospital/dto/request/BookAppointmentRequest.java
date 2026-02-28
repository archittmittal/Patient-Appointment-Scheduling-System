package com.hospital.dto.request;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Request DTO for booking an appointment.
 * Uses Java 21 record for immutability and conciseness.
 */
public record BookAppointmentRequest(

        @NotNull(message = "Patient ID is required")
        Integer patientId,

        Integer doctorId,             // Optional if using department-level load balancing

        Integer departmentId,         // Used for load-balanced booking

        @NotNull(message = "Appointment date is required")
        @FutureOrPresent(message = "Date must be today or in the future")
        LocalDate date,

        LocalTime startTime,          // Optional if using auto-scheduling

        LocalTime endTime,            // Optional if using auto-scheduling

        @Min(value = 10, message = "Duration must be at least 10 minutes")
        @Max(value = 120, message = "Duration cannot exceed 120 minutes")
        Integer durationMinutes,      // For auto-scheduling

        @Size(max = 500, message = "Reason cannot exceed 500 characters")
        String reasonForVisit,

        @Min(value = 1) @Max(value = 5)
        Integer priorityLevel,

        @Min(value = 1) @Max(value = 5)
        Integer urgencyLevel
) {
    public BookAppointmentRequest {
        if (durationMinutes == null) durationMinutes = 20;
        if (priorityLevel == null) priorityLevel = 3;
        if (urgencyLevel == null) urgencyLevel = 1;
    }
}
