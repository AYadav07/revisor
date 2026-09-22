package com.ay.revisor.auth;

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

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    AuthUserResponse signup(@Valid @RequestBody SignupRequest request, HttpServletRequest http) {
        rateLimiter.checkSignup(http.getRemoteAddr());
        return AuthUserResponse.from(authService.signup(request));
    }

    @PostMapping("/login")
    ResponseEntity<SessionResponse> login(@Valid @RequestBody LoginRequest request) {
        rateLimiter.checkLogin(request.email());
        Instant now = clock.instant();
        return session(authService.login(request, now), now);
    }

    /** Rotates the refresh token; the browser sends the cookie automatically (API.md). */
    @PostMapping("/refresh")
    ResponseEntity<SessionResponse> refresh(@CookieValue(name = AuthCookies.REFRESH, required = false) String refreshToken) {
        Instant now = clock.instant();
        return session(authService.refresh(refreshToken, now), now);
    }

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
