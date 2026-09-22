package com.ay.revisor.course;

import com.ay.revisor.auth.Role;
import com.ay.revisor.auth.User;
import com.ay.revisor.auth.UserRepository;
import com.ay.revisor.review.LearningRecord;
import com.ay.revisor.review.LearningRecordRepository;
import com.ay.revisor.support.PostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The behavior ARCHITECTURE.md §10 specifically wants real Postgres for: FK
 * {@code ON DELETE CASCADE} across the whole course->topic->subtopic->review chain, and unique
 * constraints — neither is meaningfully exercised by H2 unit tests using mocked repositories.
 */
class CourseRepositoryPostgresTest extends PostgresIntegrationTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CourseRepository courseRepository;
    @Autowired
    private TopicRepository topicRepository;
    @Autowired
    private SubtopicRepository subtopicRepository;
    @Autowired
    private LearningRecordRepository learningRecordRepository;

    @AfterEach
    void cleanUp() {
        userRepository.deleteAll();
    }

    @Test
    void deletingAUser_cascadesThroughCourseTopicSubtopicAndTheirReviewData() {
        Long userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        Long courseId = courseRepository.save(new Course(userId, "System Design", null)).getId();
        Long topicId = topicRepository.save(new Topic(courseId, userId, "Caching", 0)).getId();
        Long subtopicId = subtopicRepository.save(new Subtopic(topicId, userId, "L4 vs L7", null)).getId();
        Long learningRecordId = learningRecordRepository.save(new LearningRecord(subtopicId, userId, Instant.now())).getId();

        userRepository.deleteById(userId);

        assertThat(courseRepository.findById(courseId)).isEmpty();
        assertThat(topicRepository.findById(topicId)).isEmpty();
        assertThat(subtopicRepository.findById(subtopicId)).isEmpty();
        assertThat(learningRecordRepository.findById(learningRecordId)).isEmpty();
    }

    @Test
    void findByIdAndUserId_returnsEmpty_forACourseOwnedByAnotherUser() {
        Long owner = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        Long intruder = userRepository.save(new User("Bob", "bob@example.com", "hash", Role.USER, true, "UTC")).getId();
        Long courseId = courseRepository.save(new Course(owner, "Ann's", null)).getId();

        assertThat(courseRepository.findByIdAndUserId(courseId, intruder)).isEmpty();
        assertThat(courseRepository.findByIdAndUserId(courseId, owner)).isPresent();
    }

    @Test
    void appUserEmail_hasARealUniqueConstraint() {
        userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC"));

        assertThatThrownBy(() -> userRepository.saveAndFlush(new User("Ann2", "ann@example.com", "hash2", Role.USER, true, "UTC")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void learningRecord_hasARealUniqueConstraintOnSubtopicId_backingLearnsIdempotency() {
        Long userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        Long courseId = courseRepository.save(new Course(userId, "C", null)).getId();
        Long topicId = topicRepository.save(new Topic(courseId, userId, "T", 0)).getId();
        Long subtopicId = subtopicRepository.save(new Subtopic(topicId, userId, "S", null)).getId();
        learningRecordRepository.save(new LearningRecord(subtopicId, userId, Instant.now()));

        assertThatThrownBy(() -> learningRecordRepository.saveAndFlush(new LearningRecord(subtopicId, userId, Instant.now())))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
