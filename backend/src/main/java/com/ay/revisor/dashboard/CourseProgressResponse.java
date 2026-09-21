package com.ay.revisor.dashboard;

public record CourseProgressResponse(Long courseId, String courseTitle, int learnedCount, int totalCount) {
}
