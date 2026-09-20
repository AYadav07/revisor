package com.ay.revisor.course;

import com.ay.revisor.shared.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseServiceImplTest {

    private static final Long USER_ID = 1L;

    @Mock
    private CourseRepository courseRepository;
    @Mock
    private TopicRepository topicRepository;
    @Mock
    private SubtopicRepository subtopicRepository;

    private CourseServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new CourseServiceImpl(courseRepository, topicRepository, subtopicRepository, new CourseMapperImpl());
    }

    @Test
    void createCourse_savesAndReturnsMappedCourse() {
        CourseRequest request = new CourseRequest("System Design", "prep notes");
        Course saved = withId(new Course(USER_ID, "System Design", "prep notes"), 10L);
        when(courseRepository.save(any(Course.class))).thenReturn(saved);

        CourseResponse response = service.createCourse(USER_ID, request);

        assertThat(response).isEqualTo(new CourseResponse(10L, "System Design", "prep notes"));
    }

    @Test
    void getCourseDetail_assemblesNestedTopicsAndSubtopicsGroupedByTopic() {
        Course course = withId(new Course(USER_ID, "System Design", null), 1L);
        Topic topic = withId(new Topic(1L, USER_ID, "Load Balancing", 0), 10L);
        Subtopic subtopic = withId(new Subtopic(10L, USER_ID, "L4 vs L7", "notes"), 100L);

        when(courseRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(course));
        when(topicRepository.findAllByCourseIdAndUserIdAndDeletedAtIsNullOrderByOrderIndexAsc(1L, USER_ID))
                .thenReturn(List.of(topic));
        when(subtopicRepository.findAllByTopicIdInAndUserIdAndDeletedAtIsNullOrderByIdAsc(List.of(10L), USER_ID))
                .thenReturn(List.of(subtopic));

        CourseDetailResponse detail = service.getCourseDetail(USER_ID, 1L);

        assertThat(detail.topics()).hasSize(1);
        TopicNode topicNode = detail.topics().get(0);
        assertThat(topicNode.id()).isEqualTo(10L);
        assertThat(topicNode.subtopics()).containsExactly(new SubtopicNode(100L, "L4 vs L7", "notes"));
    }

    @Test
    void getCourseDetail_skipsSubtopicLookup_whenCourseHasNoTopics() {
        Course course = withId(new Course(USER_ID, "Empty", null), 1L);
        when(courseRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(course));
        when(topicRepository.findAllByCourseIdAndUserIdAndDeletedAtIsNullOrderByOrderIndexAsc(1L, USER_ID))
                .thenReturn(List.of());

        CourseDetailResponse detail = service.getCourseDetail(USER_ID, 1L);

        assertThat(detail.topics()).isEmpty();
        verify(subtopicRepository, never())
                .findAllByTopicIdInAndUserIdAndDeletedAtIsNullOrderByIdAsc(any(), any());
    }

    @Test
    void getCourseDetail_throwsNotFound_whenCourseNotOwnedByUser() {
        when(courseRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getCourseDetail(USER_ID, 1L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void createTopic_throwsNotFound_whenParentCourseNotOwnedByUser() {
        when(courseRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createTopic(USER_ID, 1L, new TopicRequest("t", 0)))
                .isInstanceOf(NotFoundException.class);

        verify(topicRepository, never()).save(any());
    }

    @Test
    void deleteTopic_softDeletesTopicAndCascadesToItsSubtopics() {
        Topic topic = withId(new Topic(1L, USER_ID, "Load Balancing", 0), 10L);
        when(topicRepository.findByIdAndUserIdAndDeletedAtIsNull(10L, USER_ID)).thenReturn(Optional.of(topic));

        service.deleteTopic(USER_ID, 10L);

        assertThat(topic.getDeletedAt()).isNotNull();
        verify(subtopicRepository).softDeleteAllByTopicId(eq(10L), any(Instant.class));
    }

    @Test
    void deleteSubtopic_setsDeletedAt_whenOwnedAndNotAlreadyDeleted() {
        Subtopic subtopic = withId(new Subtopic(10L, USER_ID, "L4 vs L7", null), 100L);
        when(subtopicRepository.findByIdAndUserIdAndDeletedAtIsNull(100L, USER_ID)).thenReturn(Optional.of(subtopic));

        service.deleteSubtopic(USER_ID, 100L);

        assertThat(subtopic.getDeletedAt()).isNotNull();
    }

    @Test
    void updateSubtopic_throwsNotFound_whenSubtopicAlreadySoftDeleted() {
        when(subtopicRepository.findByIdAndUserIdAndDeletedAtIsNull(100L, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateSubtopic(USER_ID, 100L, new SubtopicRequest("t", null)))
                .isInstanceOf(NotFoundException.class);
    }

    private static <T> T withId(T entity, Long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
