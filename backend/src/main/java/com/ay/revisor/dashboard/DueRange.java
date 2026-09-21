package com.ay.revisor.dashboard;

/**
 * Window for {@code GET /api/v1/dashboard/due?range=today|week}. Both are measured from
 * the user's own "today" and include anything overdue. {@code WEEK} is a rolling seven
 * calendar days (today plus the next six), not a Monday–Sunday week.
 */
public enum DueRange {

    TODAY(0),
    WEEK(6);

    private final int daysAhead;

    DueRange(int daysAhead) {
        this.daysAhead = daysAhead;
    }

    public int daysAhead() {
        return daysAhead;
    }
}
