package com.ay.revisor.course;

import com.ay.revisor.shared.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Topics", description = "Topics within the caller's courses.")
@RestController
@RequestMapping("/api/v1/topics")
class TopicController {

    private final CourseService courseService;

    TopicController(CourseService courseService) {
        this.courseService = courseService;
    }

    @Operation(summary = "Get a topic")
    @GetMapping("/{id}")
    TopicResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return courseService.getTopic(user.id(), id);
    }

    @Operation(summary = "Rename or reorder a topic")
    @PutMapping("/{id}")
    TopicResponse update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                         @Valid @RequestBody TopicRequest request) {
        return courseService.updateTopic(user.id(), id, request);
    }

    /** Soft delete; cascades to the topic's subtopics (API.md). */
    @Operation(summary = "Delete a topic", description = "Soft delete; its subtopics go with it.")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        courseService.deleteTopic(user.id(), id);
    }

    @Operation(summary = "Add a subtopic to a topic")
    @PostMapping("/{id}/subtopics")
    @ResponseStatus(HttpStatus.CREATED)
    SubtopicResponse createSubtopic(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                                    @Valid @RequestBody SubtopicRequest request) {
        return courseService.createSubtopic(user.id(), id, request);
    }
}
