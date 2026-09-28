package com.ay.revisor.auth;

import java.time.Instant;

/**
 * Redeeming emailed links and (re)sending them (SECURITY.md "Email verification & password reset").
 * The two request methods never reveal whether an email is registered: they return normally either
 * way, and only send when there is someone to send to.
 */
public interface EmailVerificationService {

    /**
     * Marks the token's user as verified and consumes the token.
     *
     * @throws com.ay.revisor.shared.InvalidTokenException if the token is unknown, expired, used, meant
     *         for password reset, or belongs to a disabled account
     */
    void verifyEmail(String token, Instant now);

    /** Emails a fresh verification link to an existing, enabled, unverified account; otherwise does nothing. */
    void resendVerification(String email, Instant now);

    /** Emails a password reset link to an existing, enabled account; otherwise does nothing. */
    void requestPasswordReset(String email, Instant now);

    /**
     * Sets the new password, consumes the token, revokes every refresh token the user holds (signed out
     * everywhere) and marks the email verified. Does not sign the user in.
     *
     * @throws com.ay.revisor.shared.InvalidTokenException as for {@link #verifyEmail}
     */
    void resetPassword(String token, String newPassword, Instant now);
}
