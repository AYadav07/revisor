package com.ay.revisor.review;

/** How many of the given subtopics are scheduled before today (overdue) and exactly today. */
public record DueCounts(long overdue, long dueToday) {
}
