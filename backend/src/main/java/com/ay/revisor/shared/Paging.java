package com.ay.revisor.shared;

/**
 * Limits for the {@code page}/{@code size} query parameters every list endpoint takes
 * (ARCHITECTURE.md §5: pagination from day one). Out-of-range values are rejected with a 400
 * rather than silently clamped, so a client bug is visible instead of quietly wrong.
 */
public final class Paging {

    public static final String DEFAULT_SIZE = "20";
    public static final int MAX_SIZE = 100;

    private Paging() {
    }
}
