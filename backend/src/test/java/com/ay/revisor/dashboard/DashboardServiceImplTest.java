package com.ay.revisor.dashboard;

import com.ay.revisor.course.CourseService;
import com.ay.revisor.course.CourseSubtopicIds;
import com.ay.revisor.course.SubtopicContext;
import com.ay.revisor.review.DueCounts;
import com.ay.revisor.review.DueSubtopic;
import com.ay.revisor.review.ReviewService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceImplTest {

    private static final Long USER_ID = 1L;
    private static final Pageable PAGE = PageRequest.of(0, 20);
    // 2026-09-21T23:30Z is already 2026-09-22 in Asia/Kolkata (UTC+5:30).
    private static final Instant NOW = Instant.parse("2026-09-21T23:30:00Z");

    @Mock
    private CourseService courseService;
    @Mock
    private ReviewService reviewService;

    private DashboardServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new DashboardServiceImpl(courseService, reviewService);
    }

    @Test
    void getDue_todayRange_usesUsersLocalDateNotUtc() {
        Set<Long> live = Set.of(100L);
        LocalDate kolkataToday = LocalDate.of(2026, 9, 22);
        when(courseService.findLiveSubtopicIds(USER_ID)).thenReturn(live);
        when(reviewService.findDue(USER_ID, kolkataToday, live, PAGE)).thenReturn(Page.empty(PAGE));

        Page<DueItemResponse> result = service.getDue(USER_ID, DueRange.TODAY, NOW, ZoneId.of("Asia/Kolkata"), PAGE);

        assertThat(result.getContent()).isEmpty();
    }

    @Test
    void getDue_weekRange_extendsWindowSixDaysPastToday() {
        Set<Long> live = Set.of(100L);
        when(courseService.findLiveSubtopicIds(USER_ID)).thenReturn(live);
        when(reviewService.findDue(USER_ID, LocalDate.of(2026, 9, 27), live, PAGE)).thenReturn(Page.empty(PAGE));

        service.getDue(USER_ID, DueRange.WEEK, NOW, ZoneOffset.UTC, PAGE);
        // Unstubbed args would return null from the mock and NPE above — reaching here is the assertion.
    }

    @Test
    void getDue_enrichesItemsWithContextAndComputesDaysOverdue() {
        Set<Long> live = Set.of(100L, 101L);
        LocalDate today = LocalDate.of(2026, 9, 21);
        when(courseService.findLiveSubtopicIds(USER_ID)).thenReturn(live);
        when(reviewService.findDue(USER_ID, today, live, PAGE)).thenReturn(new PageImpl<>(List.of(
                new DueSubtopic(100L, LocalDate.of(2026, 9, 18)),
                new DueSubtopic(101L, today)), PAGE, 2));
        when(courseService.describeSubtopics(USER_ID, List.of(100L, 101L))).thenReturn(Map.of(
                100L, new SubtopicContext(100L, "L4 vs L7", 10L, "Load Balancing", 1L, "System Design"),
                101L, new SubtopicContext(101L, "Sticky sessions", 10L, "Load Balancing", 1L, "System Design")));

        Page<DueItemResponse> result = service.getDue(USER_ID, DueRange.TODAY, NOW, ZoneOffset.UTC, PAGE);

        assertThat(result.getContent()).extracting(DueItemResponse::subtopicId, DueItemResponse::daysOverdue)
                .containsExactly(org.assertj.core.groups.Tuple.tuple(100L, 3), org.assertj.core.groups.Tuple.tuple(101L, 0));
        assertThat(result.getContent().get(0).courseTitle()).isEqualTo("System Design");
        assertThat(result.getTotalElements()).isEqualTo(2);
    }

    @Test
    void getDue_dropsItemsWhoseSubtopicVanishedBetweenLookups_keepingTotalFromReviewPage() {
        Set<Long> live = Set.of(100L, 101L);
        LocalDate today = LocalDate.of(2026, 9, 21);
        when(courseService.findLiveSubtopicIds(USER_ID)).thenReturn(live);
        when(reviewService.findDue(USER_ID, today, live, PAGE)).thenReturn(new PageImpl<>(List.of(
                new DueSubtopic(100L, today), new DueSubtopic(101L, today)), PAGE, 2));
        when(courseService.describeSubtopics(USER_ID, List.of(100L, 101L))).thenReturn(Map.of(
                100L, new SubtopicContext(100L, "L4 vs L7", 10L, "Load Balancing", 1L, "System Design")));

        Page<DueItemResponse> result = service.getDue(USER_ID, DueRange.TODAY, NOW, ZoneOffset.UTC, PAGE);

        assertThat(result.getContent()).extracting(DueItemResponse::subtopicId).containsExactly(100L);
    }

    @Test
    void getSummary_usesTheUsersLocalDate_andCountsOnlyLiveLearnedSubtopics() {
        Set<Long> live = Set.of(100L, 101L);
        // 2026-09-21T23:30Z is already the 22nd in Asia/Kolkata.
        when(courseService.findLiveSubtopicIds(USER_ID)).thenReturn(live);
        when(reviewService.countDue(USER_ID, LocalDate.of(2026, 9, 22), live)).thenReturn(new DueCounts(3, 2));
        // 999 was learned, then its subtopic was soft-deleted.
        when(reviewService.findLearnedSubtopicIds(USER_ID)).thenReturn(Set.of(100L, 999L));

        DashboardSummaryResponse summary = service.getSummary(USER_ID, NOW, ZoneId.of("Asia/Kolkata"));

        assertThat(summary).isEqualTo(new DashboardSummaryResponse(2, 3, 1));
    }

    @Test
    void getProgress_countsOnlyLiveLearnedSubtopicsPerCourse() {
        // 999 was learned but its subtopic was soft-deleted, so it isn't in any course's live set.
        when(reviewService.findLearnedSubtopicIds(USER_ID)).thenReturn(Set.of(100L, 999L));
        when(courseService.listCourseSubtopicIds(USER_ID)).thenReturn(List.of(
                new CourseSubtopicIds(1L, "System Design", Set.of(100L, 101L, 102L)),
                new CourseSubtopicIds(2L, "Empty course", Set.of())));

        List<CourseProgressResponse> progress = service.getProgress(USER_ID);

        assertThat(progress).containsExactly(
                new CourseProgressResponse(1L, "System Design", 1, 3),
                new CourseProgressResponse(2L, "Empty course", 0, 0));
    }
}
