package com.ay.revisor.course;

import java.util.Set;

/** A course and the IDs of its live (non-deleted) subtopics, for cross-module progress views. */
public record CourseSubtopicIds(Long courseId, String courseTitle, Set<Long> subtopicIds) {
}
