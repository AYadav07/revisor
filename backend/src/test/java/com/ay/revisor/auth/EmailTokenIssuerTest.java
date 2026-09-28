package com.ay.revisor.auth;

import com.ay.revisor.shared.EmailVerificationRequested;
import com.ay.revisor.shared.PasswordResetRequested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class EmailTokenIssuerTest {

    private static final Instant NOW = Instant.parse("2026-09-29T10:00:00Z");

    @Mock
    private EmailTokenRepository emailTokenRepository;
    @Mock
    private ApplicationEventPublisher events;

    @Test
    void issueVerification_retiresOlderLinks_storesOnlyTheHash_andAnnouncesTheRawToken() {
        EmailTokenIssuer issuer = new EmailTokenIssuer(emailTokenRepository, events);

        issuer.issueVerification(user(), NOW);

        ArgumentCaptor<EmailToken> stored = ArgumentCaptor.forClass(EmailToken.class);
        ArgumentCaptor<EmailVerificationRequested> event = ArgumentCaptor.forClass(EmailVerificationRequested.class);
        InOrder order = inOrder(emailTokenRepository);
        order.verify(emailTokenRepository).invalidateUnused(3L, EmailTokenPurpose.VERIFY_EMAIL, NOW);
        order.verify(emailTokenRepository).save(stored.capture());
        verify(events).publishEvent(event.capture());

        assertThat(stored.getValue().getPurpose()).isEqualTo(EmailTokenPurpose.VERIFY_EMAIL);
        assertThat(stored.getValue().getExpiresAt()).isEqualTo(NOW.plus(EmailTokenIssuer.VERIFY_EMAIL_TTL));
        assertThat(stored.getValue().getTokenHash()).isEqualTo(OpaqueTokens.hash(event.getValue().rawToken()))
                .isNotEqualTo(event.getValue().rawToken());
        assertThat(event.getValue().email()).isEqualTo("ann@example.com");
        assertThat(event.getValue().validFor()).isEqualTo(EmailTokenIssuer.VERIFY_EMAIL_TTL);
        assertThat(event.getValue().toString()).doesNotContain(event.getValue().rawToken()).doesNotContain("ann@");
    }

    @Test
    void issuePasswordReset_usesTheResetPurposeAndItsShortExpiry() {
        EmailTokenIssuer issuer = new EmailTokenIssuer(emailTokenRepository, events);

        issuer.issuePasswordReset(user(), NOW);

        ArgumentCaptor<EmailToken> stored = ArgumentCaptor.forClass(EmailToken.class);
        ArgumentCaptor<PasswordResetRequested> event = ArgumentCaptor.forClass(PasswordResetRequested.class);
        verify(emailTokenRepository).invalidateUnused(3L, EmailTokenPurpose.RESET_PASSWORD, NOW);
        verify(emailTokenRepository).save(stored.capture());
        verify(events).publishEvent(event.capture());
        assertThat(stored.getValue().getPurpose()).isEqualTo(EmailTokenPurpose.RESET_PASSWORD);
        assertThat(stored.getValue().getExpiresAt()).isEqualTo(NOW.plus(EmailTokenIssuer.RESET_PASSWORD_TTL));
        assertThat(EmailTokenIssuer.RESET_PASSWORD_TTL.toMinutes()).isEqualTo(30);
    }

    private static User user() {
        User user = new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC");
        ReflectionTestUtils.setField(user, "id", 3L);
        return user;
    }
}
