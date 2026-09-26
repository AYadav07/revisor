package com.ay.revisor.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

@Tag(name = "Auth", description = "Sign up, sign in and session cookies. Public: these endpoints need no access token.")
@SecurityRequirements // public: overrides the global cookie requirement
@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

    private final AuthService authService;
    private final AccessTokenIssuer accessTokenIssuer;
    private final AuthCookies cookies;
    private final Clock clock;
    private final AuthRateLimiter rateLimiter;

    AuthController(AuthService authService, AccessTokenIssuer accessTokenIssuer, AuthCookies cookies, Clock clock,
                   AuthRateLimiter rateLimiter) {
        this.authService = authService;
        this.accessTokenIssuer = accessTokenIssuer;
        this.cookies = cookies;
        this.clock = clock;
        this.rateLimiter = rateLimiter;
    }

    @Operation(summary = "Create an account", description = "Rate-limited per IP. 409 if the email is already registered.")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    AuthUserResponse signup(@Valid @RequestBody SignupRequest request, HttpServletRequest http) {
        rateLimiter.checkSignup(http.getRemoteAddr());
        return AuthUserResponse.from(authService.signup(request));
    }

    @Operation(summary = "Sign in", description = "Sets the access and refresh cookies. Rate-limited per email; 401 on bad credentials or a disabled account.")
    @PostMapping("/login")
    ResponseEntity<SessionResponse> login(@Valid @RequestBody LoginRequest request) {
        rateLimiter.checkLogin(request.email());
        Instant now = clock.instant();
        return session(authService.login(request, now), now);
    }

    /** Rotates the refresh token; the browser sends the cookie automatically (API.md). */
    @Operation(summary = "Rotate the session", description = "Exchanges the refresh cookie for new access and refresh cookies. Reusing an old refresh token revokes its whole family.")
    @PostMapping("/refresh")
    ResponseEntity<SessionResponse> refresh(@CookieValue(name = AuthCookies.REFRESH, required = false) String refreshToken) {
        Instant now = clock.instant();
        return session(authService.refresh(refreshToken, now), now);
    }

    @Operation(summary = "Sign out", description = "Revokes the refresh token's family and clears both cookies. Safe to call without a session.")
    @PostMapping("/logout")
    ResponseEntity<Void> logout(@CookieValue(name = AuthCookies.REFRESH, required = false) String refreshToken) {
        authService.logout(refreshToken, clock.instant());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookies.clearAccess().toString())
                .header(HttpHeaders.SET_COOKIE, cookies.clearRefresh().toString())
                .build();
    }

    private ResponseEntity<SessionResponse> session(AuthResult result, Instant now) {
        String accessToken = accessTokenIssuer.issue(result.user(), now);
        Duration refreshMaxAge = Duration.between(now, result.refreshTokenExpiresAt());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookies.access(accessToken).toString())
                .header(HttpHeaders.SET_COOKIE, cookies.refresh(result.refreshToken(), refreshMaxAge).toString())
                .body(new SessionResponse(AuthUserResponse.from(result.user())));
    }
}
