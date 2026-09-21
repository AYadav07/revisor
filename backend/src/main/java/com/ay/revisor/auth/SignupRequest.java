package com.ay.revisor.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank @Size(max = 255) String name,
        @NotBlank @Email @Size(max = 255) String email,
        // 8 minimum per SECURITY.md; 72 is BCrypt's input limit.
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @ValidTimezone String timezone
) {
}
