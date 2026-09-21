package com.ay.revisor.course;

import java.util.List;

public record TopicTreeNode(Long id, String title, int orderIndex, List<SubtopicTreeNode> subtopics) {
}
