package com.ay.revisor.notification;

/** Sends a notification on every channel configured for its type (ARCHITECTURE.md §8). */
public interface NotificationService {

    void notify(Notification notification);
}
