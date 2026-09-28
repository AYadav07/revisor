package com.ay.revisor.notification;

import java.util.Map;

/**
 * One message to one user, independent of how it will be delivered.
 *
 * @param userId for logging — the only identifier the notification module ever logs
 * @param data   template variables, e.g. {@code name}, {@code link}, {@code expiresIn}
 */
public record Notification(NotificationType type, Long userId, Recipient to, Map<String, String> data) {

    @Override
    public String toString() { // data holds the token link; it must never reach a log
        return "Notification[type=" + type + ", userId=" + userId + "]";
    }
}
