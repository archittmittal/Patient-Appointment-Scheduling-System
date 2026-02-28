package com.hospital.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Response DTO for appointment details.
 * Enriched with DSA algorithm outputs (no-show prediction, conflict status).
 */
public record AppointmentResponse(
        Integer appointmentId,
        Integer patientId,
        String patientName,
        Integer doctorId,
        String doctorName,
        String departmentName,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime,
        String appointmentType,
        String status,
        int priorityLevel,
        int urgencyLevel,
        int expectedDuration,
        String caseComplexity,

        // DSA Algorithm outputs
        BigDecimal noshowProbability,      // From Prediction Model
        boolean reminderSent,
        String reasonForVisit,
        String tokenNumber                  // From Queue system
) {}
