package com.ay.revisor.auth;

import com.ay.revisor.shared.UnauthorizedException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Runs against in-memory H2. Covers what mocks can't: that reuse detection's family
 * revocation actually commits even though the call ends in an exception.
 */
@SpringBootTest
class AuthServiceIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-09-22T10:00:00Z");

    @Autowired
    private AuthService authService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @AfterEach
    void cleanUp() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void reusingARotatedAwayToken_revokesTheWholeFamilyAndTheRevocationCommits() {
        authService.signup(new SignupRequest("Ann", "ann@example.com", "correct-horse", "UTC"));
        String first = authService.login(new LoginRequest("ann@example.com", "correct-horse"), NOW).refreshToken();
        String second = authService.refresh(first, NOW.plusSeconds(60)).refreshToken();

        assertThatThrownBy(() -> authService.refresh(first, NOW.plusSeconds(120)))
                .isInstanceOf(UnauthorizedException.class);

        assertThat(refreshTokenRepository.findAll()).hasSize(2)
                .allSatisfy(token -> assertThat(token.getRevokedAt()).isNotNull());
        // The legitimate holder's current token died with the family.
        assertThatThrownBy(() -> authService.refresh(second, NOW.plusSeconds(180)))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void loginRefreshLogout_walksTheHappyPathAndLogoutEndsTheSession() {
        authService.signup(new SignupRequest("Ann", "ann@example.com", "correct-horse", "UTC"));
        String first = authService.login(new LoginRequest("ann@example.com", "correct-horse"), NOW).refreshToken();
        AuthResult rotated = authService.refresh(first, NOW.plusSeconds(60));

        assertThat(rotated.user().email()).isEqualTo("ann@example.com");

        authService.logout(rotated.refreshToken(), NOW.plusSeconds(120));

        assertThatThrownBy(() -> authService.refresh(rotated.refreshToken(), NOW.plusSeconds(180)))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void storedPasswordIsBcryptNotPlaintext() {
        authService.signup(new SignupRequest("Ann", "ann@example.com", "correct-horse", "UTC"));

        assertThat(userRepository.findByEmail("ann@example.com")).get()
                .extracting(User::getPasswordHash).asString().startsWith("$2");
    }
}
