package com.ay.revisor.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Fans a notification out to its routed channels, retrying each with exponential backoff. Runs on the
 * notification executor, never on a request thread. No persistent outbox in v1: if every attempt fails,
 * the error is logged and the user can ask for another link (ARCHITECTURE.md §8).
 * <p>
 * Logs user id, type and channel only — never the address or the rendered body, which holds the link.
 */
@Service
class NotificationServiceImpl implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationServiceImpl.class);

    private final ChannelRouter router;
    private final Map<Channel, NotificationChannel> channels = new EnumMap<>(Channel.class);
    private final int maxAttempts;
    private final Duration retryBackoff;

    NotificationServiceImpl(ChannelRouter router, List<NotificationChannel> channels, NotificationProperties properties) {
        this.router = router;
        channels.forEach(channel -> this.channels.put(channel.channel(), channel));
        this.maxAttempts = Math.max(1, properties.maxAttempts());
        this.retryBackoff = properties.retryBackoff();
    }

    @Override
    public void notify(Notification notification) {
        for (Channel channel : router.channelsFor(notification.type())) {
            NotificationChannel implementation = channels.get(channel);
            if (implementation == null) {
                log.warn("{} for user {} is routed to {}, which isn't available; skipped",
                        notification.type(), notification.userId(), channel);
                continue;
            }
            sendWithRetry(implementation, notification);
        }
    }

    private void sendWithRetry(NotificationChannel channel, Notification notification) {
        Duration wait = retryBackoff;
        for (int attempt = 1; ; attempt++) {
            try {
                channel.send(notification);
                log.info("Sent {} to user {} via {}", notification.type(), notification.userId(), channel.channel());
                return;
            } catch (RuntimeException e) {
                // The exception's class only: provider messages can echo the recipient address.
                if (attempt >= maxAttempts) {
                    log.error("Failed to send {} to user {} via {} after {} attempts ({})", notification.type(),
                            notification.userId(), channel.channel(), attempt, e.getClass().getSimpleName());
                    return;
                }
                log.warn("Attempt {} to send {} to user {} via {} failed ({}); retrying in {}", attempt,
                        notification.type(), notification.userId(), channel.channel(), e.getClass().getSimpleName(), wait);
                if (!sleep(wait)) {
                    return;
                }
                wait = wait.multipliedBy(2);
            }
        }
    }

    private static boolean sleep(Duration duration) {
        try {
            Thread.sleep(duration);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); // shutting down: stop retrying
            return false;
        }
    }
}
