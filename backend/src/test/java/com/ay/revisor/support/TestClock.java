package com.ay.revisor.support;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** A settable clock so controller tests can pin "now" and assert exact, timezone-dependent dates. */
public class TestClock extends Clock {

    public static final Instant DEFAULT_INSTANT = Instant.parse("2026-09-22T10:00:00Z");

    private volatile Instant instant = DEFAULT_INSTANT;

    public void setInstant(Instant instant) {
        this.instant = instant;
    }

    public void reset() {
        this.instant = DEFAULT_INSTANT;
    }

    @Override
    public Instant instant() {
        return instant;
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return this;
    }
}
