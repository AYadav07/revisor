package com.ay.revisor.notification;

import com.ay.revisor.shared.EmailVerificationRequested;
import com.ay.revisor.shared.PasswordResetRequested;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

/**
 * Turns {@code auth}'s domain events into notifications (ARCHITECTURE.md §8). {@code AFTER_COMMIT}: no
 * email for a signup or reset that rolled back. {@code @Async}: a slow or failing mail server never
 * delays or fails the HTTP request that caused it.
 * <p>
 * Links point at the frontend page, which POSTs the token to the API — never at an API GET, which email
 * scanners would prefetch and so consume the token (SECURITY.md).
 */
@Component
public class NotificationListener {

    private final NotificationService notificationService;
    private final String frontendUrl;

    public NotificationListener(NotificationService notificationService, AppMailProperties mail) {
        this.notificationService = notificationService;
        this.frontendUrl = stripTrailingSlash(mail.frontendUrl());
    }

    @Async(NotificationConfig.EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onVerificationRequested(EmailVerificationRequested event) {
        notificationService.notify(new Notification(NotificationType.VERIFY_EMAIL, event.userId(),
                new Recipient(event.name(), event.email(), null),
                data(event.name(), "/verify-email", event.rawToken(), event.validFor())));
    }

    @Async(NotificationConfig.EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPasswordResetRequested(PasswordResetRequested event) {
        notificationService.notify(new Notification(NotificationType.PASSWORD_RESET, event.userId(),
                new Recipient(event.name(), event.email(), null),
                data(event.name(), "/reset-password", event.rawToken(), event.validFor())));
    }

    private Map<String, String> data(String name, String path, String rawToken, Duration validFor) {
        String link = frontendUrl + path + "?token=" + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
        return Map.of("name", name, "link", link, "expiresIn", describe(validFor));
    }

    /** "24 hours", "30 minutes", "1 hour". */
    static String describe(Duration duration) {
        long minutes = duration.toMinutes();
        if (minutes % 60 == 0) {
            long hours = minutes / 60;
            return hours + (hours == 1 ? " hour" : " hours");
        }
        return minutes + (minutes == 1 ? " minute" : " minutes");
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
