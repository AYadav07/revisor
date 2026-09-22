package com.ay.revisor.dashboard;

import com.ay.revisor.auth.UserService;
import com.ay.revisor.shared.AuthenticatedUser;
import com.ay.revisor.shared.PageResponse;
import com.ay.revisor.shared.Paging;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard")
class DashboardController {

    private final DashboardService dashboardService;
    private final UserService userService;
    private final Clock clock;

    DashboardController(DashboardService dashboardService, UserService userService, Clock clock) {
        this.dashboardService = dashboardService;
        this.userService = userService;
        this.clock = clock;
    }

    /** Due (and overdue) subtopics, oldest first, with "today" taken in the caller's own timezone. */
    @GetMapping("/due")
    PageResponse<DueItemResponse> due(@AuthenticationPrincipal AuthenticatedUser user,
                                       @RequestParam(defaultValue = "today") DueRange range,
                                       @RequestParam(defaultValue = "0") @Min(0) int page,
                                       @RequestParam(defaultValue = Paging.DEFAULT_SIZE) @Min(1) @Max(Paging.MAX_SIZE) int size) {
        return PageResponse.from(dashboardService.getDue(user.id(), range, clock.instant(),
                userService.getTimezone(user.id()), PageRequest.of(page, size)));
    }

    /** The stat tiles: due today, overdue, and total learned. */
    @GetMapping("/summary")
    DashboardSummaryResponse summary(@AuthenticationPrincipal AuthenticatedUser user) {
        return dashboardService.getSummary(user.id(), clock.instant(), userService.getTimezone(user.id()));
    }

    /** One entry per course, not paginated: the dashboard draws a progress bar for each. */
    @GetMapping("/progress")
    List<CourseProgressResponse> progress(@AuthenticationPrincipal AuthenticatedUser user) {
        return dashboardService.getProgress(user.id());
    }
}
