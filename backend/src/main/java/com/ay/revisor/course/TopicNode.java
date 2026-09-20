package com.ay.revisor.course;

import java.util.List;

public record TopicNode(Long id, String title, int orderIndex, List<SubtopicNode> subtopics) {
}
