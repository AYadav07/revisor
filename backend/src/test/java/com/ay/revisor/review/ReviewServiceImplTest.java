package com.ay.revisor.review;

import com.ay.revisor.course.CourseService;
import com.ay.revisor.course.SubtopicResponse;
import com.ay.revisor.shared.ConflictException;
import com.ay.revisor.shared.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReviewServiceImplTest {

    private static final Long USER_ID = 1L;
    private static final Long SUBTOPIC_ID = 100L;
    private static final Instant NOW = Instant.parse("2026-09-21T10:00:00Z");

    @Mock
    private LearningRecordRepository learningRecordRepository;
    @Mock
    private ReviewLogRepository reviewLogRepository;
    @Mock
    private ScheduleEntryRepository scheduleEntryRepository;
    @Mock
    private CourseService courseService;

    private ReviewServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ReviewServiceImpl(learningRecordRepository, reviewLogRepository, scheduleEntryRepository, courseService);
        when(courseService.getSubtopic(USER_ID, SUBTOPIC_ID))
                .thenReturn(new SubtopicResponse(SUBTOPIC_ID, 10L, "L4 vs L7", null));
    }

    @Test
    void learn_createsLearningRecordAndScheduleEntry_whenNotAlreadyLearned() {
        when(learningRecordRepository.findBySubtopicIdAndUserId(SUBTOPIC_ID, USER_ID)).thenReturn(Optional.empty());

        LearnResponse response = service.learn(USER_ID, SUBTOPIC_ID, NOW, ZoneOffset.UTC);

        assertThat(response.learnedAt()).isEqualTo(NOW);
        assertThat(response.nextReviewDate()).isEqualTo(LocalDate.of(2026, 9, 22));
        verify(learningRecordRepository).save(any(LearningRecord.class));
        verify(scheduleEntryRepository).save(any(ScheduleEntry.class));
    }

    @Test
    void learn_isIdempotent_returningExistingRecordUnchangedWithoutSavingAgain() {
        Instant originalLearnedAt = Instant.parse("2026-09-01T00:00:00Z");
        LocalDate originalNextReviewDate = LocalDate.of(2026, 9, 5);
        when(learningRecordRepository.findBySubtopicIdAndUserId(SUBTOPIC_ID, USER_ID))
                .thenReturn(Optional.of(new LearningRecord(SUBTOPIC_ID, USER_ID, originalLearnedAt)));
        when(scheduleEntryRepository.findBySubtopicIdAndUserId(SUBTOPIC_ID, USER_ID))
                .thenReturn(Optional.of(new ScheduleEntry(SUBTOPIC_ID, USER_ID, originalNextReviewDate)));

        LearnResponse response = service.learn(USER_ID, SUBTOPIC_ID, NOW, ZoneOffset.UTC);

        assertThat(response.learnedAt()).isEqualTo(originalLearnedAt);
        assertThat(response.nextReviewDate()).isEqualTo(originalNextReviewDate);
        verify(learningRecordRepository, never()).save(any());
        verify(scheduleEntryRepository, never()).save(any());
    }

    @Test
    void learn_propagatesNotFound_whenSubtopicNotOwnedByUser() {
        when(courseService.getSubtopic(USER_ID, SUBTOPIC_ID)).thenThrow(NotFoundException.of("Subtopic", SUBTOPIC_ID));

        assertThatThrownBy(() -> service.learn(USER_ID, SUBTOPIC_ID, NOW, ZoneOffset.UTC))
                .isInstanceOf(NotFoundException.class);
        verify(learningRecordRepository, never()).findBySubtopicIdAndUserId(any(), any());
    }

    @Test
    void review_throwsConflict_whenSubtopicHasNoLearningRecordYet() {
        when(learningRecordRepository.findBySubtopicIdAndUserId(SUBTOPIC_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.review(USER_ID, SUBTOPIC_ID, new ReviewRequest(4), NOW, ZoneOffset.UTC))
                .isInstanceOf(ConflictException.class);
        verify(reviewLogRepository, never()).save(any());
    }

    @Test
    void review_usesSm2InitialState_whenNoPriorReviewLogExists() {
        when(learningRecordRepository.findBySubtopicIdAndUserId(SUBTOPIC_ID, USER_ID))
                .thenReturn(Optional.of(new LearningRecord(SUBTOPIC_ID, USER_ID, NOW)));
        when(reviewLogRepository.findFirstBySubtopicIdAndUserIdOrderByReviewedAtDescIdDesc(SUBTOPIC_ID, USER_ID))
                .thenReturn(Optional.empty());
        when(scheduleEntryRepository.findBySubtopicIdAndUserId(SUBTOPIC_ID, USER_ID))
                .thenReturn(Optional.of(new ScheduleEntry(SUBTOPIC_ID, USER_ID, LocalDate.of(2026, 9, 22))));

        ReviewResponse response = service.review(USER_ID, SUBTOPIC_ID, new ReviewRequest(4), NOW, ZoneOffset.UTC);

        assertThat(response.repetitionCount()).isEqualTo(1);
        assertThat(response.intervalDays()).isEqualTo(1);
        assertThat(response.nextReviewDate()).isEqualTo(LocalDate.of(2026, 9, 22));
    }

    @Test
    void review_continuesFromLatestReviewLogState() {
        when(learningRecordRepository.findBySubtopicIdAndUserId(SUBTOPIC_ID, USER_ID))
                .thenReturn(Optional.of(new LearningRecord(SUBTOPIC_ID, USER_ID, NOW)));
        ReviewLog previousLog = new ReviewLog(SUBTOPIC_ID, USER_ID, NOW.minusSeconds(86400), 4,
                BigDecimal.valueOf(2.60), 1, 1);
        when(reviewLogRepository.findFirstBySubtopicIdAndUserIdOrderByReviewedAtDescIdDesc(SUBTOPIC_ID, USER_ID))
                .thenReturn(Optional.of(previousLog));
        when(scheduleEntryRepository.findBySubtopicIdAndUserId(SUBTOPIC_ID, USER_ID))
                .thenReturn(Optional.of(new ScheduleEntry(SUBTOPIC_ID, USER_ID, LocalDate.of(2026, 9, 21))));

        ReviewResponse response = service.review(USER_ID, SUBTOPIC_ID, new ReviewRequest(4), NOW, ZoneOffset.UTC);

        assertThat(response.repetitionCount()).isEqualTo(2);
        assertThat(response.intervalDays()).isEqualTo(6);
        assertThat(response.nextReviewDate()).isEqualTo(LocalDate.of(2026, 9, 27));
    }
}
