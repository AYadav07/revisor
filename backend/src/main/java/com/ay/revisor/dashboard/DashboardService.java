package com.ay.revisor.dashboard;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

/**
 * Read-side views across the course and review modules. Talks to them only through
 * their service interfaces. {@code now}/{@code userZone} are passed in for the same
 * reason as in {@code ReviewService}: the caller resolves the user's timezone.
 */
public interface DashboardService {

    Page<DueItemResponse> getDue(Long userId, DueRange range, Instant now, ZoneId userZone, Pageable pageable);

    List<CourseProgressResponse> getProgress(Long userId);
}
