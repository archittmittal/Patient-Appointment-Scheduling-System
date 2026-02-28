package com.hospital.exception;

/**
 * Thrown when an invalid operation is attempted (e.g., checking in an already checked-in patient).
 */
public class InvalidOperationException extends RuntimeException {
    public InvalidOperationException(String message) {
        super(message);
    }
}
