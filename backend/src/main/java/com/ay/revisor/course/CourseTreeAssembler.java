package com.ay.revisor.course;

import com.ay.revisor.review.ReviewService;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Merges the course-owned tree with review-owned progress. Done here, above both services,
 * because {@code ReviewService} already depends on {@code CourseService}; having
 * {@code CourseService} call back into review would make the two beans circular.
 */
@Component
class CourseTreeAssembler {

    private final CourseService courseService;
    private final ReviewService reviewService;

    CourseTreeAssembler(CourseService courseService, ReviewService reviewService) {
        this.courseService = courseService;
        this.reviewService = reviewService;
    }

    CourseTreeResponse assemble(Long userId, Long courseId) {
        CourseDetailResponse course = courseService.getCourseDetail(userId, courseId);
        List<Long> subtopicIds = course.topics().stream()
                .flatMap(topic -> topic.subtopics().stream())
                .map(SubtopicNode::id)
                .toList();
        Map<Long, LocalDate> nextReviewDates = reviewService.findNextReviewDates(userId, subtopicIds);

        List<TopicTreeNode> topics = course.topics().stream()
                .map(topic -> new TopicTreeNode(topic.id(), topic.title(), topic.orderIndex(),
                        topic.subtopics().stream()
                                .map(subtopic -> new SubtopicTreeNode(subtopic.id(), subtopic.title(), subtopic.notes(),
                                        nextReviewDates.containsKey(subtopic.id()),
                                        nextReviewDates.get(subtopic.id())))
                                .toList()))
                .toList();
        return new CourseTreeResponse(course.id(), course.title(), course.description(), topics);
    }
}
