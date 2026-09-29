package com.ay.revisor.notification.transport.email;

/**
 * Email transport. Separate from any future {@code SmsSender}: SMS has no subject or HTML part, so one
 * shared "send(to, subject, body)" would force it to ignore half its arguments (ARCHITECTURE.md §8).
 * <p>
 * Implementations throw on failure; retrying is the caller's job.
 */
public interface EmailSender {

    void send(EmailMessage message);
}
