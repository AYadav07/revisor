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

@Tag(name = "Auth", description = "Sign up, sign in, session cookies, email verification and password reset. Public: these endpoints need no access token.")
@SecurityRequirements // public: overrides the global cookie requirement
@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

    private final AuthService authService;
    private final AccessTokenIssuer accessTokenIssuer;
    private final AuthCookies cookies;
    private final Clock clock;
    private final AuthRateLimiter rateLimiter;
    private final EmailVerificationService emailVerificationService;

    AuthController(AuthService authService, AccessTokenIssuer accessTokenIssuer, AuthCookies cookies, Clock clock,
                   AuthRateLimiter rateLimiter, EmailVerificationService emailVerificationService) {
        this.authService = authService;
        this.accessTokenIssuer = accessTokenIssuer;
        this.cookies = cookies;
        this.clock = clock;
        this.rateLimiter = rateLimiter;
        this.emailVerificationService = emailVerificationService;
    }

    @Operation(summary = "Create an account", description = "Creates an unverified account and emails a verification link. Rate-limited per IP. 409 if the email is already registered.")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    AuthUserResponse signup(@Valid @RequestBody SignupRequest request, HttpServletRequest http) {
        rateLimiter.checkSignup(http.getRemoteAddr());
        return AuthUserResponse.from(authService.signup(request, clock.instant()));
    }

    @Operation(summary = "Sign in", description = "Sets the access and refresh cookies. Rate-limited per email; 401 on bad credentials or a disabled account; 403 email-not-verified if the password is right but the email isn't verified.")
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

    @Operation(summary = "Verify an email address", description = "Redeems the token from the emailed link. 400 invalid-token if it is unknown, expired or already used.")
    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.OK)
    void verifyEmail(@Valid @RequestBody TokenRequest request, HttpServletRequest http) {
        rateLimiter.checkTokenRedemption(http.getRemoteAddr());
        emailVerificationService.verifyEmail(request.token(), clock.instant());
    }

    @Operation(summary = "Resend the verification email", description = "Always 202, whether or not the address is registered (no account enumeration). Rate-limited per address and IP.")
    @PostMapping("/resend-verification")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void resendVerification(@Valid @RequestBody EmailRequest request, HttpServletRequest http) {
        rateLimiter.checkEmailSend("verify", request.email(), http.getRemoteAddr());
        emailVerificationService.resendVerification(request.email(), clock.instant());
    }

    @Operation(summary = "Request a password reset link", description = "Always 202, whether or not the address is registered (no account enumeration). Rate-limited per address and IP.")
    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void forgotPassword(@Valid @RequestBody EmailRequest request, HttpServletRequest http) {
        rateLimiter.checkEmailSend("reset", request.email(), http.getRemoteAddr());
        emailVerificationService.requestPasswordReset(request.email(), clock.instant());
    }

    @Operation(summary = "Set a new password", description = "Redeems the reset token, signs the user out everywhere, and does not sign them in. 400 invalid-token if the token is unknown, expired or used.")
    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void resetPassword(@Valid @RequestBody ResetPasswordRequest request, HttpServletRequest http) {
        rateLimiter.checkTokenRedemption(http.getRemoteAddr());
        emailVerificationService.resetPassword(request.token(), request.newPassword(), clock.instant());
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
