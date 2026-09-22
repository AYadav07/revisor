package com.ay.revisor.auth;

import com.ay.revisor.shared.TooManyRequestsException;
import io.github.bucket4j.TimeMeter;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthRateLimiterTest {

    private final FakeTime time = new FakeTime();
    private final AuthRateLimiter limiter = new AuthRateLimiter(time);

    @Test
    void allowsFiveLoginAttemptsPerEmailThenRejectsTheSixth() {
        for (int i = 0; i < 5; i++) {
            limiter.checkLogin("ann@example.com");
        }

        assertThatThrownBy(() -> limiter.checkLogin("ann@example.com")).isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void retryAfterIsTheTimeUntilTheWindowRefills() {
        for (int i = 0; i < 5; i++) {
            limiter.checkLogin("ann@example.com");
        }
        time.advance(Duration.ofMinutes(5));

        assertThatThrownBy(() -> limiter.checkLogin("ann@example.com"))
                .isInstanceOfSatisfying(TooManyRequestsException.class,
                        e -> assertThat(e.getRetryAfterSeconds()).isEqualTo(Duration.ofMinutes(10).toSeconds()));
    }

    @Test
    void allowsAttemptsAgainOnceTheFifteenMinuteWindowHasPassed() {
        for (int i = 0; i < 5; i++) {
            limiter.checkLogin("ann@example.com");
        }
        time.advance(Duration.ofMinutes(15));

        assertThatCode(() -> limiter.checkLogin("ann@example.com")).doesNotThrowAnyException();
    }

    @Test
    void treatsEmailsCaseAndWhitespaceInsensitively_soVaryingTheSpellingDoesNotEvadeTheLimit() {
        limiter.checkLogin("Ann@Example.com");
        limiter.checkLogin("  ann@example.com ");
        limiter.checkLogin("ANN@EXAMPLE.COM");
        limiter.checkLogin("ann@example.com");
        limiter.checkLogin("ann@EXAMPLE.com");

        assertThatThrownBy(() -> limiter.checkLogin("ann@example.com")).isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void keepsEmailsIndependent_soOneUsersLockoutDoesNotAffectAnother() {
        for (int i = 0; i < 5; i++) {
            limiter.checkLogin("ann@example.com");
        }

        assertThatCode(() -> limiter.checkLogin("bob@example.com")).doesNotThrowAnyException();
    }

    @Test
    void allowsTenSignupsPerIpPerHourThenRejects_withoutTouchingLoginLimits() {
        for (int i = 0; i < 10; i++) {
            limiter.checkSignup("203.0.113.7");
        }

        assertThatThrownBy(() -> limiter.checkSignup("203.0.113.7")).isInstanceOf(TooManyRequestsException.class);
        assertThatCode(() -> limiter.checkSignup("203.0.113.8")).doesNotThrowAnyException();
        assertThatCode(() -> limiter.checkLogin("203.0.113.7")).doesNotThrowAnyException();

        time.advance(Duration.ofHours(1));
        assertThatCode(() -> limiter.checkSignup("203.0.113.7")).doesNotThrowAnyException();
    }

    @Test
    void clearForgetsEverything() {
        for (int i = 0; i < 5; i++) {
            limiter.checkLogin("ann@example.com");
        }
        limiter.clear();

        assertThatCode(() -> limiter.checkLogin("ann@example.com")).doesNotThrowAnyException();
    }

    private static final class FakeTime implements TimeMeter {
        private long nanos = 1_000_000_000L;

        void advance(Duration duration) {
            nanos += duration.toNanos();
        }

        @Override
        public long currentTimeNanos() {
            return nanos;
        }

        @Override
        public boolean isWallClockBased() {
            return false;
        }
    }
}
