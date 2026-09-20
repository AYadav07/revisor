package com.ay.revisor.course;

import com.ay.revisor.shared.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
class CourseServiceImpl implements CourseService {

    private final CourseRepository courseRepository;
    private final TopicRepository topicRepository;
    private final SubtopicRepository subtopicRepository;
    private final CourseMapper mapper;

    CourseServiceImpl(CourseRepository courseRepository, TopicRepository topicRepository,
                       SubtopicRepository subtopicRepository, CourseMapper mapper) {
        this.courseRepository = courseRepository;
        this.topicRepository = topicRepository;
        this.subtopicRepository = subtopicRepository;
        this.mapper = mapper;
    }

    @Override
    public CourseResponse createCourse(Long userId, CourseRequest request) {
        Course course = new Course(userId, request.title(), request.description());
        return mapper.toResponse(courseRepository.save(course));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CourseResponse> listCourses(Long userId, Pageable pageable) {
        return courseRepository.findAllByUserId(userId, pageable).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public CourseDetailResponse getCourseDetail(Long userId, Long courseId) {
        Course course = findOwnedCourse(userId, courseId);
        List<Topic> topics = topicRepository
                .findAllByCourseIdAndUserIdAndDeletedAtIsNullOrderByOrderIndexAsc(courseId, userId);
        Map<Long, List<SubtopicNode>> subtopicsByTopicId = loadSubtopicsByTopicId(userId, topics);

        List<TopicNode> topicNodes = topics.stream()
                .map(topic -> new TopicNode(
                        topic.getId(),
                        topic.getTitle(),
                        topic.getOrderIndex(),
                        subtopicsByTopicId.getOrDefault(topic.getId(), List.of())))
                .toList();

        return new CourseDetailResponse(course.getId(), course.getTitle(), course.getDescription(), topicNodes);
    }

    @Override
    public CourseResponse updateCourse(Long userId, Long courseId, CourseRequest request) {
        Course course = findOwnedCourse(userId, courseId);
        course.setTitle(request.title());
        course.setDescription(request.description());
        return mapper.toResponse(course);
    }

    @Override
    public void deleteCourse(Long userId, Long courseId) {
        courseRepository.delete(findOwnedCourse(userId, courseId));
    }

    @Override
    public TopicResponse createTopic(Long userId, Long courseId, TopicRequest request) {
        findOwnedCourse(userId, courseId);
        Topic topic = new Topic(courseId, userId, request.title(), request.orderIndex());
        return mapper.toResponse(topicRepository.save(topic));
    }

    @Override
    @Transactional(readOnly = true)
    public TopicResponse getTopic(Long userId, Long topicId) {
        return mapper.toResponse(findOwnedTopic(userId, topicId));
    }

    @Override
    public TopicResponse updateTopic(Long userId, Long topicId, TopicRequest request) {
        Topic topic = findOwnedTopic(userId, topicId);
        topic.setTitle(request.title());
        topic.setOrderIndex(request.orderIndex());
        return mapper.toResponse(topic);
    }

    @Override
    public void deleteTopic(Long userId, Long topicId) {
        Topic topic = findOwnedTopic(userId, topicId);
        Instant deletedAt = Instant.now();
        topic.setDeletedAt(deletedAt);
        subtopicRepository.softDeleteAllByTopicId(topicId, deletedAt);
    }

    @Override
    public SubtopicResponse createSubtopic(Long userId, Long topicId, SubtopicRequest request) {
        findOwnedTopic(userId, topicId);
        Subtopic subtopic = new Subtopic(topicId, userId, request.title(), request.notes());
        return mapper.toResponse(subtopicRepository.save(subtopic));
    }

    @Override
    @Transactional(readOnly = true)
    public SubtopicResponse getSubtopic(Long userId, Long subtopicId) {
        return mapper.toResponse(findOwnedSubtopic(userId, subtopicId));
    }

    @Override
    public SubtopicResponse updateSubtopic(Long userId, Long subtopicId, SubtopicRequest request) {
        Subtopic subtopic = findOwnedSubtopic(userId, subtopicId);
        subtopic.setTitle(request.title());
        subtopic.setNotes(request.notes());
        return mapper.toResponse(subtopic);
    }

    @Override
    public void deleteSubtopic(Long userId, Long subtopicId) {
        findOwnedSubtopic(userId, subtopicId).setDeletedAt(Instant.now());
    }

    private Map<Long, List<SubtopicNode>> loadSubtopicsByTopicId(Long userId, List<Topic> topics) {
        if (topics.isEmpty()) {
            return Map.of();
        }
        List<Long> topicIds = topics.stream().map(Topic::getId).toList();
        return subtopicRepository.findAllByTopicIdInAndUserIdAndDeletedAtIsNullOrderByIdAsc(topicIds, userId)
                .stream()
                .collect(Collectors.groupingBy(Subtopic::getTopicId, Collectors.mapping(mapper::toNode, Collectors.toList())));
    }

    private Course findOwnedCourse(Long userId, Long courseId) {
        return courseRepository.findByIdAndUserId(courseId, userId)
                .orElseThrow(() -> NotFoundException.of("Course", courseId));
    }

    private Topic findOwnedTopic(Long userId, Long topicId) {
        return topicRepository.findByIdAndUserIdAndDeletedAtIsNull(topicId, userId)
                .orElseThrow(() -> NotFoundException.of("Topic", topicId));
    }

    private Subtopic findOwnedSubtopic(Long userId, Long subtopicId) {
        return subtopicRepository.findByIdAndUserIdAndDeletedAtIsNull(subtopicId, userId)
                .orElseThrow(() -> NotFoundException.of("Subtopic", subtopicId));
    }
}
