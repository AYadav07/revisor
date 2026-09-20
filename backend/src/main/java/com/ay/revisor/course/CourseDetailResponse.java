package com.ay.revisor.course;

import java.util.List;

/**
 * Backs GET /api/v1/courses/{id} (see API.md). {@code learned}/{@code nextReviewDate}
 * per subtopic are review-module data and are deliberately not included here yet —
 * course module has no dependency on review; wiring those in is scoped to the review
 * service pass.
 */
public record CourseDetailResponse(Long id, String title, String description, List<TopicNode> topics) {
}
