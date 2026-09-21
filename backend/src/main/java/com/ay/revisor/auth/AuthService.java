package com.ay.revisor.auth;

import java.time.Instant;

/**
 * Signup, login, refresh-token rotation and logout (SECURITY.md). Issues and validates
 * opaque refresh tokens only; minting the RS256 access token is the security layer's job.
 * {@code now} is passed in, as in the other services, so behavior is a pure function of inputs.
 */
public interface AuthService {

    /** @throws com.ay.revisor.shared.ConflictException if the email is already registered */
    UserResponse signup(SignupRequest request);

    /**
     * Starts a new token family.
     *
     * @throws com.ay.revisor.shared.UnauthorizedException on unknown email, wrong password or
     *         disabled account — indistinguishable to the caller by design
     */
    AuthResult login(LoginRequest request, Instant now);

    /**
     * Rotates the refresh token: the presented one is revoked and a replacement in the same
     * family is issued. Presenting an already-revoked token is treated as theft and revokes the
     * whole family before failing (SECURITY.md).
     *
     * @throws com.ay.revisor.shared.UnauthorizedException if the token is unknown, expired,
     *         revoked, or its user is disabled
     */
    AuthResult refresh(String refreshToken, Instant now);

    /** Revokes the session the token belongs to. Idempotent: an unknown or blank token is a no-op. */
    void logout(String refreshToken, Instant now);
}
