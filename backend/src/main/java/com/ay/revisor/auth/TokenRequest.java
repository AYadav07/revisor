package com.ay.revisor.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body of verify-email: the opaque token from the emailed link. */
public record TokenRequest(@NotBlank @Size(max = 100) String token) {
}
