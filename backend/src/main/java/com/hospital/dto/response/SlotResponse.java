package com.hospital.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Response DTO for available time slot.
 */
public record SlotResponse(
        Integer slotId,
        Integer doctorId,
        String doctorName,
        String departmentName,
        LocalDate slotDate,
        LocalTime startTime,
        LocalTime endTime,
        int slotDuration,
        String slotStatus,
        BigDecimal doctorUtilization        // Load balancing metric
) {}
