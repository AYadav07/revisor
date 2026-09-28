package com.ay.revisor.notification;

/**
 * One implementation per {@link Channel}: renders the notification for its medium and hands it to that
 * medium's transport. Adding SMS means adding an implementation, not editing this or any existing one.
 */
public interface NotificationChannel {

    Channel channel();

    /** Renders and delivers. Skips silently when the recipient has no address for this channel. */
    void send(Notification notification);
}
