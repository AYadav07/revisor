package com.ay.revisor.review;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Map;
import java.util.Set;

/**
 * Public seam other modules call through — never {@link LearningRecordRepository},
 * {@link ReviewLogRepository}, or {@link ScheduleEntryRepository} directly.
 * <p>
 * {@code now}/{@code userZone} are passed in rather than resolved internally (e.g. via
 * a Clock bean or a lookup into the auth module), keeping this service a pure function
 * of its inputs and easy to unit test. The caller (the controller layer, once built) is
 * responsible for resolving the authenticated user's IANA timezone.
 */
public interface ReviewService {

    LearnResponse learn(Long userId, Long subtopicId, Instant now, ZoneId userZone);

    ReviewResponse review(Long userId, Long subtopicId, ReviewRequest request, Instant now, ZoneId userZone);

    /**
     * The user's scheduled subtopics due on or before {@code onOrBefore} (overdue included),
     * oldest first, restricted to {@code subtopicIds}. The caller supplies the live subtopic
     * IDs so soft-deleted subtopics never count toward pages or totals — this module has no
     * view of course-module deletion state.
     */
    Page<DueSubtopic> findDue(Long userId, LocalDate onOrBefore, Collection<Long> subtopicIds, Pageable pageable);

    /**
     * Next review date for each of the given subtopics that the user has learned, keyed by
     * subtopic ID. A subtopic absent from the map is not learned — a LearningRecord and its
     * ScheduleEntry are always created together, so "has a date" and "learned" are the same fact.
     */
    Map<Long, LocalDate> findNextReviewDates(Long userId, Collection<Long> subtopicIds);

    /**
     * Counts of scheduled subtopics due before {@code today} (overdue) and exactly on it,
     * restricted to {@code subtopicIds} for the same reason as {@link #findDue}.
     */
    DueCounts countDue(Long userId, LocalDate today, Collection<Long> subtopicIds);

    /** IDs of every subtopic the user has marked as learned. */
    Set<Long> findLearnedSubtopicIds(Long userId);
}
