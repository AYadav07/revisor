package com.ay.revisor.course;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

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
}
