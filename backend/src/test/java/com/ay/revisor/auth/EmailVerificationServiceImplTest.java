package com.ay.revisor.auth;

import com.ay.revisor.shared.InvalidTokenException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailVerificationServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-09-29T10:00:00Z");
    private static final Long USER_ID = 7L;
    private static final String RAW = "raw-token";
    private static final String HASH = OpaqueTokens.hash(RAW);

    @Mock
    private UserRepository userRepository;
    @Mock
    private EmailTokenRepository emailTokenRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private EmailTokenIssuer emailTokenIssuer;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    private EmailVerificationServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new EmailVerificationServiceImpl(userRepository, emailTokenRepository, refreshTokenRepository,
                emailTokenIssuer, passwordEncoder);
    }

    @Test
    void verifyEmail_consumesTheTokenAndMarksTheUserVerified() {
        User user = user(true, false);
        tokenExists(EmailTokenPurpose.VERIFY_EMAIL);
        when(emailTokenRepository.redeem(HASH, EmailTokenPurpose.VERIFY_EMAIL, NOW)).thenReturn(1);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        service.verifyEmail(RAW, NOW);

        assertThat(user.getEmailVerifiedAt()).isEqualTo(NOW);
    }

    @Test
    void verifyEmail_rejectsUnknownBlankUsedAndDisabledUserTokensAlike() {
        when(emailTokenRepository.findByTokenHashAndPurpose(OpaqueTokens.hash("unknown"), EmailTokenPurpose.VERIFY_EMAIL))
                .thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.verifyEmail("unknown", NOW)).isInstanceOf(InvalidTokenException.class);
        assertThatThrownBy(() -> service.verifyEmail(" ", NOW)).isInstanceOf(InvalidTokenException.class);
        assertThatThrownBy(() -> service.verifyEmail(null, NOW)).isInstanceOf(InvalidTokenException.class);

        tokenExists(EmailTokenPurpose.VERIFY_EMAIL);
        when(emailTokenRepository.redeem(HASH, EmailTokenPurpose.VERIFY_EMAIL, NOW)).thenReturn(0, 1);
        assertThatThrownBy(() -> service.verifyEmail(RAW, NOW)).isInstanceOf(InvalidTokenException.class); // used/expired

        User disabled = user(false, false);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(disabled));
        assertThatThrownBy(() -> service.verifyEmail(RAW, NOW)).isInstanceOf(InvalidTokenException.class);
        assertThat(disabled.isEmailVerified()).isFalse();
    }

    @Test
    void resendVerification_sendsOnlyToAnExistingEnabledUnverifiedAccount() {
        User unverified = user(true, false);
        when(userRepository.findByEmail("ann@example.com")).thenReturn(Optional.of(unverified));
        service.resendVerification(" Ann@Example.com ", NOW);
        verify(emailTokenIssuer).issueVerification(unverified, NOW);
    }

    @Test
    void resendVerification_doesNothingForUnknownVerifiedOrDisabledAccounts() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("ann@example.com"))
                .thenReturn(Optional.of(user(true, true)), Optional.of(user(false, false)));

        service.resendVerification("nobody@example.com", NOW);
        service.resendVerification("ann@example.com", NOW);
        service.resendVerification("ann@example.com", NOW);

        verifyNoInteractions(emailTokenIssuer);
    }

    @Test
    void requestPasswordReset_sendsToEnabledAccounts_verifiedOrNot_andSilentlySkipsTheRest() {
        User unverified = user(true, false);
        when(userRepository.findByEmail("ann@example.com")).thenReturn(Optional.of(unverified), Optional.of(user(false, true)));
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        service.requestPasswordReset("ann@example.com", NOW);
        service.requestPasswordReset("ann@example.com", NOW);
        service.requestPasswordReset("nobody@example.com", NOW);

        verify(emailTokenIssuer).issuePasswordReset(unverified, NOW);
        verify(emailTokenIssuer, never()).issueVerification(any(), any());
    }

    @Test
    void resetPassword_setsANewBcryptHash_verifiesTheEmail_thenRevokesEverySession() {
        User user = user(true, false);
        tokenExists(EmailTokenPurpose.RESET_PASSWORD);
        when(emailTokenRepository.redeem(HASH, EmailTokenPurpose.RESET_PASSWORD, NOW)).thenReturn(1);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        service.resetPassword(RAW, "battery-staple", NOW);

        assertThat(passwordEncoder.matches("battery-staple", user.getPasswordHash())).isTrue();
        assertThat(user.getEmailVerifiedAt()).isEqualTo(NOW);
        InOrder order = inOrder(emailTokenRepository, refreshTokenRepository);
        order.verify(emailTokenRepository).redeem(HASH, EmailTokenPurpose.RESET_PASSWORD, NOW);
        order.verify(refreshTokenRepository).revokeAllByUserId(USER_ID, NOW);
    }

    @Test
    void resetPassword_withATokenIssuedForVerification_isInvalid_andConsumesNothing() {
        when(emailTokenRepository.findByTokenHashAndPurpose(HASH, EmailTokenPurpose.RESET_PASSWORD)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resetPassword(RAW, "battery-staple", NOW)).isInstanceOf(InvalidTokenException.class);

        verify(emailTokenRepository, never()).redeem(any(), any(), any());
        verify(refreshTokenRepository, never()).revokeAllByUserId(any(), any());
    }

    @Test
    void verifyingAnAlreadyVerifiedUser_keepsTheOriginalTimestamp() {
        User user = user(true, true);
        Instant original = user.getEmailVerifiedAt();
        tokenExists(EmailTokenPurpose.VERIFY_EMAIL);
        when(emailTokenRepository.redeem(HASH, EmailTokenPurpose.VERIFY_EMAIL, NOW)).thenReturn(1);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        service.verifyEmail(RAW, NOW);

        assertThat(user.getEmailVerifiedAt()).isEqualTo(original);
    }

    private void tokenExists(EmailTokenPurpose purpose) {
        when(emailTokenRepository.findByTokenHashAndPurpose(HASH, purpose))
                .thenReturn(Optional.of(new EmailToken(USER_ID, purpose, HASH, NOW.plusSeconds(600))));
    }

    private static User user(boolean enabled, boolean verified) {
        User user = new User("Ann", "ann@example.com", "old-hash", Role.USER, enabled, "UTC");
        ReflectionTestUtils.setField(user, "id", USER_ID);
        if (verified) {
            user.markEmailVerified(NOW.minusSeconds(86_400));
        }
        return user;
    }
}
