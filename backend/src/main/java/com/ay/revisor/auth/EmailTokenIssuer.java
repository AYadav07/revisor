package com.ay.revisor.auth;

import com.ay.revisor.shared.EmailVerificationRequested;
import com.ay.revisor.shared.PasswordResetRequested;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * Creates an email link token and announces it. Stores only the hash, retires the user's older
 * unused tokens of the same purpose, and publishes a domain event that the {@code notification}
 * module turns into an email once the surrounding transaction commits (ARCHITECTURE.md §8) —
 * so no email goes out for a signup that rolled back. Must run inside the caller's transaction.
 */
@Component
class EmailTokenIssuer {

    static final Duration VERIFY_EMAIL_TTL = Duration.ofHours(24);
    static final Duration RESET_PASSWORD_TTL = Duration.ofMinutes(30);

    private final EmailTokenRepository emailTokenRepository;
    private final ApplicationEventPublisher events;

    EmailTokenIssuer(EmailTokenRepository emailTokenRepository, ApplicationEventPublisher events) {
        this.emailTokenRepository = emailTokenRepository;
        this.events = events;
    }

    void issueVerification(User user, Instant now) {
        String rawToken = issue(user.getId(), EmailTokenPurpose.VERIFY_EMAIL, VERIFY_EMAIL_TTL, now);
        events.publishEvent(new EmailVerificationRequested(user.getId(), user.getName(), user.getEmail(), rawToken,
                VERIFY_EMAIL_TTL));
    }

    void issuePasswordReset(User user, Instant now) {
        String rawToken = issue(user.getId(), EmailTokenPurpose.RESET_PASSWORD, RESET_PASSWORD_TTL, now);
        events.publishEvent(new PasswordResetRequested(user.getId(), user.getName(), user.getEmail(), rawToken,
                RESET_PASSWORD_TTL));
    }

    private String issue(Long userId, EmailTokenPurpose purpose, Duration ttl, Instant now) {
        emailTokenRepository.invalidateUnused(userId, purpose, now);
        String rawToken = OpaqueTokens.generate();
        emailTokenRepository.save(new EmailToken(userId, purpose, OpaqueTokens.hash(rawToken), now.plus(ttl)));
        return rawToken;
    }
}
