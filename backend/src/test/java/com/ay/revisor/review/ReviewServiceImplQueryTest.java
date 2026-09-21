package com.ay.revisor.review;

import com.ay.revisor.course.CourseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReviewServiceImplQueryTest {

    private static final Long USER_ID = 1L;
    private static final Pageable PAGE = PageRequest.of(0, 20);
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 21);

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
    }

    @Test
    void findDue_returnsEmptyPageWithoutQuerying_whenNoLiveSubtopicIds() {
        Page<DueSubtopic> result = service.findDue(USER_ID, TODAY, Set.of(), PAGE);

        assertThat(result).isEmpty();
        verifyNoInteractions(scheduleEntryRepository);
    }

    @Test
    void findDue_mapsScheduleEntriesToDueSubtopics() {
        Set<Long> ids = Set.of(100L);
        when(scheduleEntryRepository
                .findAllByUserIdAndNextReviewDateLessThanEqualAndSubtopicIdInOrderByNextReviewDateAscIdAsc(
                        USER_ID, TODAY, ids, PAGE))
                .thenReturn(new PageImpl<>(List.of(new ScheduleEntry(100L, USER_ID, TODAY.minusDays(2))), PAGE, 1));

        Page<DueSubtopic> result = service.findDue(USER_ID, TODAY, ids, PAGE);

        assertThat(result.getContent()).containsExactly(new DueSubtopic(100L, TODAY.minusDays(2)));
    }

    @Test
    void findNextReviewDates_mapsLearnedSubtopicsToTheirDate_omittingUnlearnedOnes() {
        when(scheduleEntryRepository.findAllByUserIdAndSubtopicIdIn(USER_ID, List.of(100L, 101L)))
                .thenReturn(List.of(new ScheduleEntry(100L, USER_ID, TODAY.plusDays(3))));

        assertThat(service.findNextReviewDates(USER_ID, List.of(100L, 101L)))
                .isEqualTo(Map.of(100L, TODAY.plusDays(3)));
    }

    @Test
    void findNextReviewDates_returnsEmptyWithoutQuerying_whenNoSubtopicIds() {
        assertThat(service.findNextReviewDates(USER_ID, List.of())).isEmpty();
        verifyNoInteractions(scheduleEntryRepository);
    }

    @Test
    void findLearnedSubtopicIds_returnsIdsFromLearningRecords() {
        when(learningRecordRepository.findSubtopicIdsByUserId(USER_ID)).thenReturn(List.of(100L, 101L));

        assertThat(service.findLearnedSubtopicIds(USER_ID)).containsExactlyInAnyOrder(100L, 101L);
    }
}
