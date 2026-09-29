package com.ay.revisor.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of resend-verification and forgot-password. */
public record EmailRequest(@NotBlank @Email @Size(max = 255) String email) {
}
