package com.ay.revisor.review;

import com.ay.revisor.auth.Role;
import com.ay.revisor.auth.User;
import com.ay.revisor.auth.UserRepository;
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
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The dashboard's due query is built specifically around the {@code (user_id, next_review_date)}
 * index (ARCHITECTURE.md §2/§5); this exercises it against real Postgres rather than a mock.
 */
class ScheduleEntryRepositoryPostgresTest extends PostgresIntegrationTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ScheduleEntryRepository scheduleEntryRepository;
    @Autowired
    private ReviewLogRepository reviewLogRepository;

    private Long userId;

    @AfterEach
    void cleanUp() {
        userRepository.deleteAll();
    }

    @Test
    void findAllByUserId_dueQuery_ordersByDateThenId_andRespectsTheSubtopicIdFilterAndUserScoping() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        Long otherUserId = userRepository.save(new User("Bob", "bob@example.com", "hash", Role.USER, true, "UTC")).getId();
        LocalDate today = LocalDate.of(2026, 9, 23);
        scheduleEntryRepository.save(new ScheduleEntry(102L, userId, today));           // same date as 101, tie-broken by id
        scheduleEntryRepository.save(new ScheduleEntry(101L, userId, today));
        scheduleEntryRepository.save(new ScheduleEntry(100L, userId, today.minusDays(2)));
        scheduleEntryRepository.save(new ScheduleEntry(103L, userId, today.plusDays(30))); // outside the window
        scheduleEntryRepository.save(new ScheduleEntry(104L, userId, today));              // excluded via subtopicIds filter
        scheduleEntryRepository.save(new ScheduleEntry(105L, otherUserId, today));         // another user

        Page<ScheduleEntry> due = scheduleEntryRepository
                .findAllByUserIdAndNextReviewDateLessThanEqualAndSubtopicIdInOrderByNextReviewDateAscIdAsc(
                        userId, today, Set.of(100L, 101L, 102L), PageRequest.of(0, 20));

        assertThat(due.getContent()).extracting(ScheduleEntry::getSubtopicId).containsExactly(100L, 101L, 102L);
        assertThat(due.getTotalElements()).isEqualTo(3);
    }

    @Test
    void countQueries_splitOverdueFromDueTodayCorrectly() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        LocalDate today = LocalDate.of(2026, 9, 23);
        scheduleEntryRepository.save(new ScheduleEntry(100L, userId, today.minusDays(1)));
        scheduleEntryRepository.save(new ScheduleEntry(101L, userId, today));
        scheduleEntryRepository.save(new ScheduleEntry(102L, userId, today.plusDays(1)));

        long overdue = scheduleEntryRepository.countByUserIdAndNextReviewDateLessThanAndSubtopicIdIn(
                userId, today, Set.of(100L, 101L, 102L));
        long dueToday = scheduleEntryRepository.countByUserIdAndNextReviewDateAndSubtopicIdIn(
                userId, today, Set.of(100L, 101L, 102L));

        assertThat(overdue).isEqualTo(1);
        assertThat(dueToday).isEqualTo(1);
    }

    @Test
    void scheduleEntry_hasARealUniqueConstraintOnSubtopicId() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        scheduleEntryRepository.save(new ScheduleEntry(100L, userId, LocalDate.now()));

        assertThatThrownBy(() -> scheduleEntryRepository.saveAndFlush(new ScheduleEntry(100L, userId, LocalDate.now())))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void reviewLog_quality_isRejectedOutsideZeroToFiveByARealCheckConstraint_notJustBeanValidation() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        ReviewLog outOfRange = new ReviewLog(100L, userId, Instant.now(), 6, BigDecimal.valueOf(2.50), 1, 1);

        assertThatThrownBy(() -> reviewLogRepository.saveAndFlush(outOfRange)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void reviewLog_easeFactor_survivesTheRoundTripAtNumericFourTwoPrecision() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        Long id = reviewLogRepository.saveAndFlush(
                new ReviewLog(100L, userId, Instant.now(), 4, BigDecimal.valueOf(13.37), 1, 1)).getId();
        reviewLogRepository.flush();

        BigDecimal reloaded = reviewLogRepository.findById(id).orElseThrow().getEaseFactor();
        assertThat(reloaded).isEqualByComparingTo("13.37");
    }
}
