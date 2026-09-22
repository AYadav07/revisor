package com.ay.revisor.course;

import com.ay.revisor.review.ReviewService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseTreeAssemblerTest {

    private static final Long USER_ID = 1L;

    @Mock
    private CourseService courseService;
    @Mock
    private ReviewService reviewService;

    @Test
    void marksLearnedSubtopicsWithTheirDate_andLeavesTheRestUnlearned_withOneBatchedLookup() {
        when(courseService.getCourseDetail(USER_ID, 1L)).thenReturn(new CourseDetailResponse(1L, "System Design", "d", List.of(
                new TopicNode(10L, "Caching", 0, List.of(
                        new SubtopicNode(100L, "Learned", "n1"),
                        new SubtopicNode(101L, "Not yet", null))),
                new TopicNode(11L, "Empty", 1, List.of()))));
        when(reviewService.findNextReviewDates(USER_ID, List.of(100L, 101L)))
                .thenReturn(Map.of(100L, LocalDate.of(2026, 9, 25)));

        CourseTreeResponse tree = new CourseTreeAssembler(courseService, reviewService).assemble(USER_ID, 1L);

        assertThat(tree.title()).isEqualTo("System Design");
        assertThat(tree.topics()).hasSize(2);
        assertThat(tree.topics().get(0).subtopics()).containsExactly(
                new SubtopicTreeNode(100L, "Learned", "n1", true, LocalDate.of(2026, 9, 25)),
                new SubtopicTreeNode(101L, "Not yet", null, false, null));
        assertThat(tree.topics().get(1).subtopics()).isEmpty();
    }

    @Test
    void stillAsksForProgress_evenForACourseWithNoSubtopics_leavingTheEmptyShortCircuitToReviewService() {
        when(courseService.getCourseDetail(USER_ID, 1L))
                .thenReturn(new CourseDetailResponse(1L, "Empty", null, List.of()));
        when(reviewService.findNextReviewDates(any(), any())).thenReturn(Map.of());

        assertThat(new CourseTreeAssembler(courseService, reviewService).assemble(USER_ID, 1L).topics()).isEmpty();
        verify(reviewService).findNextReviewDates(USER_ID, List.of());
    }
}
