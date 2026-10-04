package com.ay.revisor.notification;

/** What a notification is about. Each type has its own templates per channel (ARCHITECTURE.md §8). */
public enum NotificationType {
    VERIFY_EMAIL,
    PASSWORD_RESET;

    /** File-name stem of this type's templates, e.g. {@code verify-email}. */
    public String templateName() {
        return name().toLowerCase(java.util.Locale.ROOT).replace('_', '-');
    }
}
