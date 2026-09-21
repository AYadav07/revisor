package com.ay.revisor.auth;

import com.ay.revisor.shared.ConflictException;
import com.ay.revisor.shared.UnauthorizedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-09-22T10:00:00Z");
    private static final Long USER_ID = 5L;

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    // Low cost factor keeps the suite fast; the production bean uses the default strength.
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    private AuthServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AuthServiceImpl(userRepository, refreshTokenRepository, passwordEncoder, new UserMapperImpl());
    }

    @Test
    void signup_storesBcryptHashNormalizedEmailAndUserRole() {
        when(userRepository.existsByEmail("ann@example.com")).thenReturn(false);
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserResponse response = service.signup(
                new SignupRequest(" Ann ", "  Ann@Example.COM ", "correct-horse", "Asia/Kolkata"));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getEmail()).isEqualTo("ann@example.com");
        assertThat(saved.getValue().getName()).isEqualTo("Ann");
        assertThat(saved.getValue().getPasswordHash()).isNotEqualTo("correct-horse");
        assertThat(passwordEncoder.matches("correct-horse", saved.getValue().getPasswordHash())).isTrue();
        assertThat(response.role()).isEqualTo(Role.USER);
        assertThat(response.enabled()).isTrue();
    }

    @Test
    void signup_throwsConflict_whenEmailAlreadyRegistered() {
        when(userRepository.existsByEmail("ann@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.signup(new SignupRequest("Ann", "ann@example.com", "correct-horse", "UTC")))
                .isInstanceOf(ConflictException.class);
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void signup_throwsConflict_whenConcurrentSignupWinsTheUniqueConstraint() {
        when(userRepository.existsByEmail("ann@example.com")).thenReturn(false);
        when(userRepository.saveAndFlush(any(User.class))).thenThrow(new DataIntegrityViolationException("dup"));

        assertThatThrownBy(() -> service.signup(new SignupRequest("Ann", "ann@example.com", "correct-horse", "UTC")))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void login_issuesTokenInNewFamilyAndStoresOnlyItsHash() {
        when(userRepository.findByEmail("ann@example.com")).thenReturn(Optional.of(user(true)));

        AuthResult result = service.login(new LoginRequest("Ann@Example.com", "correct-horse"), NOW);

        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(saved.capture());
        assertThat(saved.getValue().getTokenHash()).isEqualTo(OpaqueTokens.hash(result.refreshToken()))
                .isNotEqualTo(result.refreshToken());
        assertThat(saved.getValue().getUserId()).isEqualTo(USER_ID);
        assertThat(saved.getValue().getExpiresAt()).isEqualTo(NOW.plus(AuthServiceImpl.REFRESH_TOKEN_TTL));
        assertThat(result.refreshTokenExpiresAt()).isEqualTo(saved.getValue().getExpiresAt());
        assertThat(result.user().email()).isEqualTo("ann@example.com");
    }

    @Test
    void login_failsIdenticallyForUnknownEmailWrongPasswordAndDisabledAccount() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("ann@example.com"))
                .thenReturn(Optional.of(user(true)), Optional.of(user(false)));

        assertThatThrownBy(() -> service.login(new LoginRequest("nobody@example.com", "correct-horse"), NOW))
                .isInstanceOf(UnauthorizedException.class).hasMessage("Invalid credentials");
        assertThatThrownBy(() -> service.login(new LoginRequest("ann@example.com", "wrong-password"), NOW))
                .isInstanceOf(UnauthorizedException.class).hasMessage("Invalid credentials");
        assertThatThrownBy(() -> service.login(new LoginRequest("ann@example.com", "correct-horse"), NOW))
                .isInstanceOf(UnauthorizedException.class).hasMessage("Invalid credentials");

        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void refresh_revokesPresentedTokenAndIssuesReplacementInSameFamily() {
        UUID family = UUID.randomUUID();
        RefreshToken current = token("raw-1", family, NOW.plusSeconds(60));
        when(refreshTokenRepository.findByTokenHash(OpaqueTokens.hash("raw-1"))).thenReturn(Optional.of(current));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(true)));

        AuthResult result = service.refresh("raw-1", NOW);

        assertThat(current.getRevokedAt()).isEqualTo(NOW);
        ArgumentCaptor<RefreshToken> replacement = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(replacement.capture());
        assertThat(replacement.getValue().getFamilyId()).isEqualTo(family);
        assertThat(replacement.getValue().getTokenHash()).isEqualTo(OpaqueTokens.hash(result.refreshToken()));
        assertThat(result.refreshToken()).isNotEqualTo("raw-1");
    }

    @Test
    void refresh_withAlreadyRevokedToken_revokesWholeFamilyThenFails() {
        UUID family = UUID.randomUUID();
        RefreshToken rotatedAway = token("raw-1", family, NOW.plusSeconds(60));
        rotatedAway.setRevokedAt(NOW.minusSeconds(10));
        when(refreshTokenRepository.findByTokenHash(OpaqueTokens.hash("raw-1"))).thenReturn(Optional.of(rotatedAway));

        assertThatThrownBy(() -> service.refresh("raw-1", NOW)).isInstanceOf(UnauthorizedException.class);

        verify(refreshTokenRepository).revokeAllByFamilyId(family, NOW);
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void refresh_failsForUnknownExpiredBlankAndDisabledUserWithoutIssuingAnything() {
        RefreshToken expired = token("raw-expired", UUID.randomUUID(), NOW);
        RefreshToken forDisabledUser = token("raw-disabled", UUID.randomUUID(), NOW.plusSeconds(60));
        when(refreshTokenRepository.findByTokenHash(OpaqueTokens.hash("raw-unknown"))).thenReturn(Optional.empty());
        when(refreshTokenRepository.findByTokenHash(OpaqueTokens.hash("raw-expired"))).thenReturn(Optional.of(expired));
        when(refreshTokenRepository.findByTokenHash(OpaqueTokens.hash("raw-disabled")))
                .thenReturn(Optional.of(forDisabledUser));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(false)));

        for (String raw : new String[]{"raw-unknown", "raw-expired", "raw-disabled", "", null}) {
            assertThatThrownBy(() -> service.refresh(raw, NOW)).isInstanceOf(UnauthorizedException.class);
        }

        verify(refreshTokenRepository, never()).save(any());
        verify(refreshTokenRepository, never()).revokeAllByFamilyId(any(), any());
    }

    @Test
    void logout_revokesTheTokensFamily() {
        UUID family = UUID.randomUUID();
        when(refreshTokenRepository.findByTokenHash(OpaqueTokens.hash("raw-1")))
                .thenReturn(Optional.of(token("raw-1", family, NOW.plusSeconds(60))));

        service.logout("raw-1", NOW);

        verify(refreshTokenRepository).revokeAllByFamilyId(family, NOW);
    }

    @Test
    void logout_isNoOpForUnknownBlankOrMissingToken() {
        when(refreshTokenRepository.findByTokenHash(OpaqueTokens.hash("raw-unknown"))).thenReturn(Optional.empty());

        service.logout("raw-unknown", NOW);
        service.logout("  ", NOW);
        service.logout(null, NOW);

        verify(refreshTokenRepository, never()).revokeAllByFamilyId(any(), any());
    }

    private User user(boolean enabled) {
        User user = new User("Ann", "ann@example.com", passwordEncoder.encode("correct-horse"), Role.USER, enabled, "UTC");
        ReflectionTestUtils.setField(user, "id", USER_ID);
        return user;
    }

    private static RefreshToken token(String raw, UUID family, Instant expiresAt) {
        return new RefreshToken(USER_ID, family, OpaqueTokens.hash(raw), expiresAt);
    }
}
