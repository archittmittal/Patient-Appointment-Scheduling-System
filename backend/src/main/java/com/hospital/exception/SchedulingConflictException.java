package com.hospital.exception;

/**
 * Thrown when a scheduling conflict is detected (overlapping appointments).
 * Maps to the fn_has_conflict interval overlap detection algorithm.
 */
public class SchedulingConflictException extends RuntimeException {
    public SchedulingConflictException(String message) {
        super(message);
    }
}
