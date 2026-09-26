package com.ay.revisor.review;

import com.ay.revisor.auth.UserService;
import com.ay.revisor.shared.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;

@Tag(name = "Learning & review", description = "Marking subtopics learned and grading reviews on the SM-2 schedule.")
@RestController
@RequestMapping("/api/v1/subtopics/{id}")
class ReviewController {

    private final ReviewService reviewService;
    private final UserService userService;
    private final Clock clock;

    ReviewController(ReviewService reviewService, UserService userService, Clock clock) {
        this.reviewService = reviewService;
        this.userService = userService;
        this.clock = clock;
    }

    /** Idempotent: repeating it on an already-learned subtopic returns the existing record unchanged (API.md). */
    @Operation(summary = "Mark a subtopic learned", description = "Schedules its first review. Idempotent: repeating it returns the existing record unchanged.")
    @PostMapping("/learn")
    LearnResponse learn(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return reviewService.learn(user.id(), id, clock.instant(), userService.getTimezone(user.id()));
    }

    /** 409 if the subtopic hasn't been learned yet; 404 if it isn't the caller's (API.md). */
    @Operation(summary = "Grade a review", description = "Quality 0-5; returns the next review date. 409 if the subtopic hasn't been learned yet.")
    @PostMapping("/review")
    ReviewResponse review(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                          @Valid @RequestBody ReviewRequest request) {
        return reviewService.review(user.id(), id, request, clock.instant(), userService.getTimezone(user.id()));
    }
}
