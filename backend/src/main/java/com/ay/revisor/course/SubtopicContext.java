package com.ay.revisor.course;

/** A subtopic together with the topic and course it sits under, for cross-module read views. */
public record SubtopicContext(
        Long subtopicId,
        String subtopicTitle,
        Long topicId,
        String topicTitle,
        Long courseId,
        String courseTitle
) {
}
