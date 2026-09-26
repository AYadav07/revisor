package com.ay.revisor.dashboard;

import com.ay.revisor.auth.UserService;
import com.ay.revisor.shared.AuthenticatedUser;
import com.ay.revisor.shared.PageResponse;
import com.ay.revisor.shared.Paging;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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

@Tag(name = "Dashboard", description = "Read-only views over the caller's schedule, with \"today\" in their own timezone.")
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
    @Operation(summary = "List due subtopics", description = "range=today or week (rolling seven days); both include overdue items. Paginated, most overdue first.")
    @GetMapping("/due")
    PageResponse<DueItemResponse> due(@AuthenticationPrincipal AuthenticatedUser user,
                                       @RequestParam(defaultValue = "today") DueRange range,
                                       @RequestParam(defaultValue = "0") @Min(0) int page,
                                       @RequestParam(defaultValue = Paging.DEFAULT_SIZE) @Min(1) @Max(Paging.MAX_SIZE) int size) {
        return PageResponse.from(dashboardService.getDue(user.id(), range, clock.instant(),
                userService.getTimezone(user.id()), PageRequest.of(page, size)));
    }

    /** The stat tiles: due today, overdue, and total learned. */
    @Operation(summary = "Get the stat tiles", description = "Due today, overdue, and total learned.")
    @GetMapping("/summary")
    DashboardSummaryResponse summary(@AuthenticationPrincipal AuthenticatedUser user) {
        return dashboardService.getSummary(user.id(), clock.instant(), userService.getTimezone(user.id()));
    }

    /** One entry per course, not paginated: the dashboard draws a progress bar for each. */
    @Operation(summary = "Get per-course progress", description = "Learned vs total subtopics per course. A plain array, not paginated.")
    @GetMapping("/progress")
    List<CourseProgressResponse> progress(@AuthenticationPrincipal AuthenticatedUser user) {
        return dashboardService.getProgress(user.id());
    }
}
