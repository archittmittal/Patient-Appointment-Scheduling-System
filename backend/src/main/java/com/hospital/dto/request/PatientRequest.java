package com.hospital.dto.request;

import jakarta.validation.constraints.*;

/**
 * Request DTO for creating/updating a patient.
 */
public record PatientRequest(

        @NotBlank(message = "First name is required")
        @Size(max = 50)
        String firstName,

        @NotBlank(message = "Last name is required")
        @Size(max = 50)
        String lastName,

        @NotBlank(message = "Phone is required")
        @Size(max = 15)
        String phone,

        @Email(message = "Invalid email format")
        String email,

        String dateOfBirth,      // ISO format: yyyy-MM-dd

        String gender,           // MALE, FEMALE, OTHER

        String address,

        String emergencyContact,

        String bloodGroup,

        String medicalHistory
) {}
