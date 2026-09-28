package com.ay.revisor.notification;

import org.springframework.stereotype.Component;

import java.util.List;

/** Decides where a notification goes, from {@code app.notifications.routes}. Knows nothing about how. */
@Component
class ChannelRouter {

    private final NotificationProperties properties;

    ChannelRouter(NotificationProperties properties) {
        this.properties = properties;
    }

    List<Channel> channelsFor(NotificationType type) {
        return properties.routes().getOrDefault(type, List.of());
    }
}
