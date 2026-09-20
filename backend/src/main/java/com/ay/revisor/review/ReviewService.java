package com.ay.revisor.review;

import java.time.Instant;
import java.time.ZoneId;

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
}
