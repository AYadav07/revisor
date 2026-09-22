package com.ay.revisor.course;

import java.util.List;

/** The full {@code GET /api/v1/courses/{id}} response from API.md: the course tree plus per-subtopic review state. */
public record CourseTreeResponse(Long id, String title, String description, List<TopicTreeNode> topics) {
}
