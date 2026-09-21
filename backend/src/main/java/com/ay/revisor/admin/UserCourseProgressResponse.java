package com.ay.revisor.admin;

/** One of a user's courses with their learned/total subtopic counts, for the read-only admin view. */
public record UserCourseProgressResponse(
        Long courseId,
        String title,
        String description,
        int learnedCount,
        int totalCount
) {
}
