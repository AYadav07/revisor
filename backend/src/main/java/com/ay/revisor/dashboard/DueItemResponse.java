package com.ay.revisor.dashboard;

import java.time.LocalDate;

/** {@code daysOverdue} is 0 for anything due today or later, measured in the user's timezone. */
public record DueItemResponse(
        Long subtopicId,
        String subtopicTitle,
        Long topicId,
        String topicTitle,
        Long courseId,
        String courseTitle,
        LocalDate nextReviewDate,
        int daysOverdue
) {
}
