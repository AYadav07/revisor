package com.ay.revisor.course;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Public seam other modules call through — never {@link CourseRepository},
 * {@link TopicRepository}, or {@link SubtopicRepository} directly.
 */
public interface CourseService {

    CourseResponse createCourse(Long userId, CourseRequest request);

    Page<CourseResponse> listCourses(Long userId, Pageable pageable);

    CourseDetailResponse getCourseDetail(Long userId, Long courseId);

    CourseResponse updateCourse(Long userId, Long courseId, CourseRequest request);

    void deleteCourse(Long userId, Long courseId);

    TopicResponse createTopic(Long userId, Long courseId, TopicRequest request);

    TopicResponse getTopic(Long userId, Long topicId);

    TopicResponse updateTopic(Long userId, Long topicId, TopicRequest request);

    void deleteTopic(Long userId, Long topicId);

    SubtopicResponse createSubtopic(Long userId, Long topicId, SubtopicRequest request);

    SubtopicResponse getSubtopic(Long userId, Long subtopicId);

    SubtopicResponse updateSubtopic(Long userId, Long subtopicId, SubtopicRequest request);

    void deleteSubtopic(Long userId, Long subtopicId);

    /** IDs of all of the user's non-deleted subtopics. */
    Set<Long> findLiveSubtopicIds(Long userId);

    /**
     * Course/topic/subtopic titles for the given subtopics, keyed by subtopic ID. Subtopics
     * that are missing, soft-deleted, or not owned by the user are simply absent from the map.
     */
    Map<Long, SubtopicContext> describeSubtopics(Long userId, Collection<Long> subtopicIds);

    /** Every course the user owns, with the IDs of its live subtopics. */
    List<CourseSubtopicIds> listCourseSubtopicIds(Long userId);
}
