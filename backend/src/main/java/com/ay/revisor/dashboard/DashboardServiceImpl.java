package com.ay.revisor.dashboard;

import com.ay.revisor.course.CourseService;
import com.ay.revisor.course.SubtopicContext;
import com.ay.revisor.review.DueSubtopic;
import com.ay.revisor.review.ReviewService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Transactional(readOnly = true)
class DashboardServiceImpl implements DashboardService {

    private final CourseService courseService;
    private final ReviewService reviewService;

    DashboardServiceImpl(CourseService courseService, ReviewService reviewService) {
        this.courseService = courseService;
        this.reviewService = reviewService;
    }

    @Override
    public Page<DueItemResponse> getDue(Long userId, DueRange range, Instant now, ZoneId userZone,
                                         Pageable pageable) {
        LocalDate today = LocalDate.ofInstant(now, userZone);
        LocalDate onOrBefore = today.plusDays(range.daysAhead());

        Set<Long> liveSubtopicIds = courseService.findLiveSubtopicIds(userId);
        Page<DueSubtopic> due = reviewService.findDue(userId, onOrBefore, liveSubtopicIds, pageable);
        Map<Long, SubtopicContext> contexts = courseService.describeSubtopics(userId,
                due.getContent().stream().map(DueSubtopic::subtopicId).toList());

        // A subtopic deleted between the two calls above has no context; drop it rather than fail.
        List<DueItemResponse> items = due.getContent().stream()
                .filter(item -> contexts.containsKey(item.subtopicId()))
                .map(item -> toResponse(item, contexts.get(item.subtopicId()), today))
                .toList();

        return new PageImpl<>(items, pageable, due.getTotalElements());
    }

    @Override
    public List<CourseProgressResponse> getProgress(Long userId) {
        Set<Long> learned = reviewService.findLearnedSubtopicIds(userId);
        return courseService.listCourseSubtopicIds(userId).stream()
                .map(course -> new CourseProgressResponse(
                        course.courseId(),
                        course.courseTitle(),
                        (int) course.subtopicIds().stream().filter(learned::contains).count(),
                        course.subtopicIds().size()))
                .toList();
    }

    private static DueItemResponse toResponse(DueSubtopic item, SubtopicContext context, LocalDate today) {
        int daysOverdue = (int) Math.max(0, ChronoUnit.DAYS.between(item.nextReviewDate(), today));
        return new DueItemResponse(context.subtopicId(), context.subtopicTitle(), context.topicId(),
                context.topicTitle(), context.courseId(), context.courseTitle(), item.nextReviewDate(), daysOverdue);
    }
}
