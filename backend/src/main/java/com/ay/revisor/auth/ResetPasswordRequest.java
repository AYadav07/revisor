package com.ay.revisor.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank @Size(max = 100) String token,
        // Same policy as signup: 8 minimum per SECURITY.md; 72 is BCrypt's input limit.
        @NotBlank @Size(min = 8, max = 72) String newPassword
) {
}
