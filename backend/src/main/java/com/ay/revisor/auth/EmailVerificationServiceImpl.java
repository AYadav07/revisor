package com.ay.revisor.auth;

import com.ay.revisor.shared.InvalidTokenException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;

/** Logs by user id only — never emails, passwords or tokens (SECURITY.md, "Logging discipline"). */
@Service
@Transactional
class EmailVerificationServiceImpl implements EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationServiceImpl.class);

    private final UserRepository userRepository;
    private final EmailTokenRepository emailTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final EmailTokenIssuer emailTokenIssuer;
    private final PasswordEncoder passwordEncoder;

    EmailVerificationServiceImpl(UserRepository userRepository, EmailTokenRepository emailTokenRepository,
                                 RefreshTokenRepository refreshTokenRepository, EmailTokenIssuer emailTokenIssuer,
                                 PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.emailTokenRepository = emailTokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.emailTokenIssuer = emailTokenIssuer;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void verifyEmail(String token, Instant now) {
        User user = redeem(token, EmailTokenPurpose.VERIFY_EMAIL, now);
        user.markEmailVerified(now);
        log.info("User {} verified their email", user.getId());
    }

    @Override
    public void resendVerification(String email, Instant now) {
        userRepository.findByEmail(normalize(email))
                .filter(User::isEnabled)
                .filter(user -> !user.isEmailVerified())
                .ifPresent(user -> {
                    emailTokenIssuer.issueVerification(user, now);
                    log.info("Verification email re-requested for user {}", user.getId());
                });
    }

    @Override
    public void requestPasswordReset(String email, Instant now) {
        userRepository.findByEmail(normalize(email))
                .filter(User::isEnabled)
                .ifPresent(user -> {
                    emailTokenIssuer.issuePasswordReset(user, now);
                    log.info("Password reset requested for user {}", user.getId());
                });
    }

    @Override
    public void resetPassword(String token, String newPassword, Instant now) {
        User user = redeem(token, EmailTokenPurpose.RESET_PASSWORD, now);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.markEmailVerified(now); // completing a reset proves they own the inbox
        // Flushes the changes above first (flushAutomatically), then signs the user out everywhere, so an
        // attacker holding a session loses it the moment the real owner resets.
        refreshTokenRepository.revokeAllByUserId(user.getId(), now);
        log.info("User {} reset their password; all sessions revoked", user.getId());
    }

    /**
     * Consumes the token and returns its (enabled) user. The lookup and the conditional update are
     * separate so a token for the other purpose is never consumed; the update alone decides who wins a race.
     */
    private User redeem(String rawToken, EmailTokenPurpose purpose, Instant now) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new InvalidTokenException();
        }
        String hash = OpaqueTokens.hash(rawToken);
        EmailToken token = emailTokenRepository.findByTokenHashAndPurpose(hash, purpose)
                .orElseThrow(InvalidTokenException::new);
        Long userId = token.getUserId();
        if (emailTokenRepository.redeem(hash, purpose, now) != 1) {
            throw new InvalidTokenException();
        }
        return userRepository.findById(userId)
                .filter(User::isEnabled)
                .orElseThrow(InvalidTokenException::new);
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
