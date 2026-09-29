package com.ay.revisor.support;

import com.ay.revisor.notification.transport.email.EmailMessage;
import com.ay.revisor.notification.transport.email.EmailSender;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Captures emails instead of sending them, so full-context tests can read the link out of a real,
 * rendered email — exactly what a user would click. Sending is asynchronous and after commit, so
 * reads wait briefly for messages to arrive.
 */
public class RecordingEmailSender implements EmailSender {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final Pattern TOKEN = Pattern.compile("[?&]token=([A-Za-z0-9_-]+)");

    private final List<EmailMessage> messages = new CopyOnWriteArrayList<>();

    @Override
    public void send(EmailMessage message) {
        messages.add(message);
    }

    public void clear() {
        messages.clear();
    }

    public List<EmailMessage> messages() {
        return List.copyOf(messages);
    }

    /** Waits until at least {@code count} emails have been sent, and returns the {@code count}-th. */
    public EmailMessage awaitMessage(int count) {
        Instant deadline = Instant.now().plus(TIMEOUT);
        while (messages.size() < count) {
            if (Instant.now().isAfter(deadline)) {
                throw new AssertionError("Expected " + count + " email(s) within " + TIMEOUT + ", got " + messages.size());
            }
            try {
                Thread.sleep(20);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new AssertionError("Interrupted while waiting for email", e);
            }
        }
        return messages.get(count - 1);
    }

    /** Gives in-flight sends time to land, for asserting that nothing more was sent. */
    public void settle() {
        try {
            Thread.sleep(300);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** The raw token from the link in an email's plain-text body. */
    public static String tokenFrom(EmailMessage message) {
        Matcher matcher = TOKEN.matcher(message.text());
        if (!matcher.find()) {
            throw new AssertionError("No token link in email \"" + message.subject() + "\"");
        }
        return matcher.group(1);
    }
}
