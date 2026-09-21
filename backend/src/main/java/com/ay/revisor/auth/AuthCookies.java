package com.ay.revisor.auth;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Builds the httpOnly auth cookies (SECURITY.md). {@code HttpOnly} and {@code SameSite=Strict}
 * are always on; only {@code Secure} varies by profile.
 * <p>
 * The refresh cookie is scoped to {@code /api/v1/auth} rather than SECURITY.md's original
 * {@code /api/v1/auth/refresh}: a cookie is only sent to URLs under its path, so the narrower
 * path would never reach {@code /auth/logout}, and logout could not revoke the token server-side.
 */
@Component
class AuthCookies {

    static final String ACCESS = "accessToken";
    static final String REFRESH = "refreshToken";
    static final String REFRESH_PATH = "/api/v1/auth";

    private final boolean secure;

    AuthCookies(AppProperties properties) {
        this.secure = properties.cookies().secure();
    }

    ResponseCookie access(String token) {
        return build(ACCESS, token, "/", AccessTokenIssuer.ACCESS_TOKEN_TTL);
    }

    ResponseCookie refresh(String token, Duration maxAge) {
        return build(REFRESH, token, REFRESH_PATH, maxAge);
    }

    ResponseCookie clearAccess() {
        return build(ACCESS, "", "/", Duration.ZERO);
    }

    ResponseCookie clearRefresh() {
        return build(REFRESH, "", REFRESH_PATH, Duration.ZERO);
    }

    private ResponseCookie build(String name, String value, String path, Duration maxAge) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path(path)
                .maxAge(maxAge)
                .build();
    }
}
