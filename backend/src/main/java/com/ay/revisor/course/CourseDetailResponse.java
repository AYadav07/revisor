package com.ay.revisor.course;

import java.util.List;

/**
 * The course module's own view of a course tree. {@code learned}/{@code nextReviewDate} per
 * subtopic are review-module data and deliberately absent: {@code CourseService} has no
 * dependency on review. {@link CourseTreeAssembler} adds them to produce the API response,
 * {@link CourseTreeResponse}.
 */
public record CourseDetailResponse(Long id, String title, String description, List<TopicNode> topics) {
}
