package com.ay.revisor.review;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Pure SM-2 spaced-repetition calculator — no Spring/JPA dependencies, unit-testable
 * in isolation. See ARCHITECTURE.md §3.
 */
public final class SM2Calculator {

    public static final BigDecimal INITIAL_EASE_FACTOR = BigDecimal.valueOf(2.5).setScale(2, RoundingMode.HALF_UP);
    public static final int INITIAL_INTERVAL_DAYS = 1;
    public static final int INITIAL_REPETITION_COUNT = 0;

    private static final BigDecimal MINIMUM_EASE_FACTOR = BigDecimal.valueOf(1.3).setScale(2, RoundingMode.HALF_UP);

    private SM2Calculator() {
    }

    public record Sm2State(BigDecimal easeFactor, int intervalDays, int repetitionCount) {
    }

    public static Sm2State initialState() {
        return new Sm2State(INITIAL_EASE_FACTOR, INITIAL_INTERVAL_DAYS, INITIAL_REPETITION_COUNT);
    }

    /**
     * quality &lt; 3 resets repetitionCount to 0 and intervalDays to 1, easeFactor
     * unchanged; quality &gt;= 3 advances ease/interval/repetitions per the standard
     * SM-2 formula. See ARCHITECTURE.md §3.
     */
    public static Sm2State next(int quality, Sm2State previous) {
        if (quality < 0 || quality > 5) {
            throw new IllegalArgumentException("quality must be between 0 and 5, was " + quality);
        }

        if (quality < 3) {
            return new Sm2State(previous.easeFactor(), 1, 0);
        }

        int repetitionCount = previous.repetitionCount() + 1;
        int intervalDays = switch (previous.repetitionCount()) {
            case 0 -> 1;
            case 1 -> 6;
            default -> (int) Math.round(previous.intervalDays() * previous.easeFactor().doubleValue());
        };

        double delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
        BigDecimal easeFactor = previous.easeFactor()
                .add(BigDecimal.valueOf(delta))
                .setScale(2, RoundingMode.HALF_UP);
        if (easeFactor.compareTo(MINIMUM_EASE_FACTOR) < 0) {
            easeFactor = MINIMUM_EASE_FACTOR;
        }

        return new Sm2State(easeFactor, intervalDays, repetitionCount);
    }
}
