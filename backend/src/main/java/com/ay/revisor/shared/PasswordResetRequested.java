package com.ay.revisor.shared;

import java.time.Duration;

/** Like {@link EmailVerificationRequested}, for a password reset link. */
public record PasswordResetRequested(Long userId, String name, String email, String rawToken, Duration validFor) {

    @Override
    public String toString() { // never let the token or address reach a log line via toString()
        return "PasswordResetRequested[userId=" + userId + "]";
    }
}
