package com.ay.revisor.notification;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationServiceImplTest {

    private static final Notification RESET = new Notification(NotificationType.PASSWORD_RESET, 1L,
            new Recipient("Ann", "ann@example.com", null), Map.of());

    @Test
    void sendsOnEveryRoutedChannel_andSkipsChannelsThatArentBuilt() {
        FakeChannel email = new FakeChannel(Channel.EMAIL, 0);
        NotificationServiceImpl service = service(Map.of(NotificationType.PASSWORD_RESET, List.of(Channel.EMAIL, Channel.SMS)),
                3, email);

        service.notify(RESET);

        assertThat(email.attempts.get()).isEqualTo(1);
    }

    @Test
    void retriesAFailingChannel_upToTheConfiguredAttempts() {
        FakeChannel flaky = new FakeChannel(Channel.EMAIL, 2);
        service(Map.of(NotificationType.PASSWORD_RESET, List.of(Channel.EMAIL)), 3, flaky).notify(RESET);
        assertThat(flaky.attempts.get()).isEqualTo(3);
        assertThat(flaky.delivered).isTrue();

        FakeChannel broken = new FakeChannel(Channel.EMAIL, Integer.MAX_VALUE);
        service(Map.of(NotificationType.PASSWORD_RESET, List.of(Channel.EMAIL)), 3, broken).notify(RESET);
        assertThat(broken.attempts.get()).isEqualTo(3); // then gives up without throwing
    }

    @Test
    void anUnroutedTypeGoesNowhere() {
        FakeChannel email = new FakeChannel(Channel.EMAIL, 0);
        service(Map.of(), 3, email).notify(RESET);
        assertThat(email.attempts.get()).isZero();
    }

    @Test
    void notificationsNeverPrintTheirLinkOrAddress() {
        Notification withLink = new Notification(NotificationType.VERIFY_EMAIL, 1L,
                new Recipient("Ann", "ann@example.com", null), Map.of("link", "https://x/?token=secret"));
        assertThat(withLink.toString()).doesNotContain("secret").doesNotContain("ann@example.com");
    }

    @Test
    void expiryIsDescribedInPlainWords() {
        assertThat(NotificationListener.describe(Duration.ofHours(24))).isEqualTo("24 hours");
        assertThat(NotificationListener.describe(Duration.ofHours(1))).isEqualTo("1 hour");
        assertThat(NotificationListener.describe(Duration.ofMinutes(30))).isEqualTo("30 minutes");
    }

    private static NotificationServiceImpl service(Map<NotificationType, List<Channel>> routes, int attempts,
                                                   NotificationChannel... channels) {
        NotificationProperties properties = new NotificationProperties(routes, attempts, Duration.ofMillis(1));
        return new NotificationServiceImpl(new ChannelRouter(properties), List.of(channels), properties);
    }

    private static final class FakeChannel implements NotificationChannel {
        private final Channel channel;
        private final int failuresBeforeSuccess;
        private final AtomicInteger attempts = new AtomicInteger();
        private boolean delivered;

        private FakeChannel(Channel channel, int failuresBeforeSuccess) {
            this.channel = channel;
            this.failuresBeforeSuccess = failuresBeforeSuccess;
        }

        @Override
        public Channel channel() {
            return channel;
        }

        @Override
        public void send(Notification notification) {
            if (attempts.incrementAndGet() <= failuresBeforeSuccess) {
                throw new IllegalStateException("provider down");
            }
            delivered = true;
        }
    }
}
