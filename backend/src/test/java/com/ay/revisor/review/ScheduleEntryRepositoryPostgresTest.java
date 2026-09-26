package com.ay.revisor.review;

import com.ay.revisor.auth.Role;
import com.ay.revisor.auth.User;
import com.ay.revisor.auth.UserRepository;
import com.ay.revisor.course.Course;
import com.ay.revisor.course.CourseRepository;
import com.ay.revisor.course.Subtopic;
import com.ay.revisor.course.SubtopicRepository;
import com.ay.revisor.course.Topic;
import com.ay.revisor.course.TopicRepository;
import com.ay.revisor.support.PostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The dashboard's due query is built specifically around the {@code (user_id, next_review_date)}
 * index (ARCHITECTURE.md §2/§5); this exercises it against real Postgres rather than a mock.
 * Schedule entries and review logs reference real subtopics, since Postgres enforces those foreign keys.
 */
class ScheduleEntryRepositoryPostgresTest extends PostgresIntegrationTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ScheduleEntryRepository scheduleEntryRepository;
    @Autowired
    private ReviewLogRepository reviewLogRepository;
    @Autowired
    private CourseRepository courseRepository;
    @Autowired
    private TopicRepository topicRepository;
    @Autowired
    private SubtopicRepository subtopicRepository;

    private Long userId;

    @AfterEach
    void cleanUp() {
        userRepository.deleteAll();
    }

    @Test
    void findAllByUserId_dueQuery_ordersByDateThenEntryId_andRespectsTheSubtopicIdFilterAndUserScoping() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        Long otherUserId = userRepository.save(new User("Bob", "bob@example.com", "hash", Role.USER, true, "UTC")).getId();
        Long overdue = subtopic(userId);
        Long tieSavedFirst = subtopic(userId);
        Long tieSavedSecond = subtopic(userId);
        Long later = subtopic(userId);
        Long filteredOut = subtopic(userId);
        Long othersSubtopic = subtopic(otherUserId);
        LocalDate today = LocalDate.of(2026, 9, 23);
        // Saved out of subtopic order: equal dates are tie-broken by the schedule entry's own id.
        scheduleEntryRepository.save(new ScheduleEntry(tieSavedFirst, userId, today));
        scheduleEntryRepository.save(new ScheduleEntry(tieSavedSecond, userId, today));
        scheduleEntryRepository.save(new ScheduleEntry(overdue, userId, today.minusDays(2)));
        scheduleEntryRepository.save(new ScheduleEntry(later, userId, today.plusDays(30)));        // outside the window
        scheduleEntryRepository.save(new ScheduleEntry(filteredOut, userId, today));                // not in subtopicIds
        scheduleEntryRepository.save(new ScheduleEntry(othersSubtopic, otherUserId, today));        // another user

        Page<ScheduleEntry> due = scheduleEntryRepository
                .findAllByUserIdAndNextReviewDateLessThanEqualAndSubtopicIdInOrderByNextReviewDateAscIdAsc(
                        userId, today, Set.of(overdue, tieSavedFirst, tieSavedSecond, later, othersSubtopic),
                        PageRequest.of(0, 20));

        assertThat(due.getContent()).extracting(ScheduleEntry::getSubtopicId)
                .containsExactly(overdue, tieSavedFirst, tieSavedSecond);
        assertThat(due.getTotalElements()).isEqualTo(3);
    }

    @Test
    void countQueries_splitOverdueFromDueTodayCorrectly() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        LocalDate today = LocalDate.of(2026, 9, 23);
        Long yesterday = subtopic(userId);
        Long dueToday = subtopic(userId);
        Long tomorrow = subtopic(userId);
        scheduleEntryRepository.save(new ScheduleEntry(yesterday, userId, today.minusDays(1)));
        scheduleEntryRepository.save(new ScheduleEntry(dueToday, userId, today));
        scheduleEntryRepository.save(new ScheduleEntry(tomorrow, userId, today.plusDays(1)));
        Set<Long> all = Set.of(yesterday, dueToday, tomorrow);

        assertThat(scheduleEntryRepository.countByUserIdAndNextReviewDateLessThanAndSubtopicIdIn(userId, today, all))
                .isEqualTo(1);
        assertThat(scheduleEntryRepository.countByUserIdAndNextReviewDateAndSubtopicIdIn(userId, today, all))
                .isEqualTo(1);
    }

    @Test
    void scheduleEntry_hasARealUniqueConstraintOnSubtopicId() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        Long subtopicId = subtopic(userId);
        scheduleEntryRepository.save(new ScheduleEntry(subtopicId, userId, LocalDate.now()));

        assertThatThrownBy(() -> scheduleEntryRepository.saveAndFlush(new ScheduleEntry(subtopicId, userId, LocalDate.now())))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void reviewLog_quality_isRejectedOutsideZeroToFiveByARealCheckConstraint_notJustBeanValidation() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        ReviewLog outOfRange = new ReviewLog(subtopic(userId), userId, Instant.now(), 6, BigDecimal.valueOf(2.50), 1, 1);

        assertThatThrownBy(() -> reviewLogRepository.saveAndFlush(outOfRange)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void reviewLog_easeFactor_survivesTheRoundTripAtNumericFourTwoPrecision() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        Long id = reviewLogRepository.saveAndFlush(
                new ReviewLog(subtopic(userId), userId, Instant.now(), 4, BigDecimal.valueOf(13.37), 1, 1)).getId();

        BigDecimal reloaded = reviewLogRepository.findById(id).orElseThrow().getEaseFactor();
        assertThat(reloaded).isEqualByComparingTo("13.37");
    }

    /** A real subtopic (in its own course and topic) for the given user, so foreign keys hold. */
    private Long subtopic(Long ownerId) {
        Long courseId = courseRepository.save(new Course(ownerId, "Course", null)).getId();
        Long topicId = topicRepository.save(new Topic(courseId, ownerId, "Topic", 0)).getId();
        return subtopicRepository.save(new Subtopic(topicId, ownerId, "Subtopic", null)).getId();
    }
}
