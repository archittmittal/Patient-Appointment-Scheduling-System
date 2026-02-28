package com.hospital.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Response DTO for live queue status.
 * Exposes the Priority Queue (Min-Heap) state to the frontend.
 */
public record QueueEntryResponse(
        Integer queueId,
        Integer appointmentId,
        Integer patientId,
        String patientName,
        Integer doctorId,
        String doctorName,

        // Priority Queue (Min-Heap) fields
        int queuePosition,                  // Current position in heap
        BigDecimal priorityScore,            // Heap key (lower = higher priority)
        int urgencyLevel,                    // 1-5 (5 = emergency)

        // Wait time (DP prediction output)
        LocalDateTime checkinTime,
        int estimatedWaitMinutes,            // From DP algorithm
        Integer actualWaitMinutes,

        String queueStatus,                 // WAITING, CALLED, IN_CONSULTATION, etc.
        String tokenNumber,
        LocalDateTime calledAt
) {}
