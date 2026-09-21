package com.ay.revisor.dashboard;

/**
 * The dashboard's stat tiles. {@code dueToday} is exactly today and {@code overdue} is strictly
 * before it, so together they equal {@code GET /dashboard/due?range=today}'s total.
 */
public record DashboardSummaryResponse(long dueToday, long overdue, long totalLearned) {
}
