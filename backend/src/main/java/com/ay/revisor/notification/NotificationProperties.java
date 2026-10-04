package com.ay.revisor.notification;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * @param routes       which channels each notification type goes out on — routing is config, not code
 * @param maxAttempts  delivery attempts per channel before giving up and logging an error
 * @param retryBackoff wait before the first retry; doubles after each failed attempt
 */
@ConfigurationProperties(prefix = "app.notifications")
public record NotificationProperties(@DefaultValue Map<NotificationType, List<Channel>> routes,
                                     @DefaultValue("3") int maxAttempts,
                                     @DefaultValue("2s") Duration retryBackoff) {
}
