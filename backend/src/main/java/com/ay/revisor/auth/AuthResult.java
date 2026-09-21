package com.ay.revisor.auth;

import java.time.Instant;

/**
 * Outcome of a successful login or refresh. {@code refreshToken} is the raw opaque value
 * — the only time it exists outside the client; only its hash is stored. The RS256 access
 * token is minted separately from {@code user} by the security layer.
 */
public record AuthResult(UserResponse user, String refreshToken, Instant refreshTokenExpiresAt) {
}
