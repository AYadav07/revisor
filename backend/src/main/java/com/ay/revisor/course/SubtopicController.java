package com.ay.revisor.course;

import com.ay.revisor.shared.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/subtopics")
class SubtopicController {

    private final CourseService courseService;

    SubtopicController(CourseService courseService) {
        this.courseService = courseService;
    }

    @GetMapping("/{id}")
    SubtopicResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return courseService.getSubtopic(user.id(), id);
    }

    @PutMapping("/{id}")
    SubtopicResponse update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                            @Valid @RequestBody SubtopicRequest request) {
        return courseService.updateSubtopic(user.id(), id, request);
    }

    /** Soft delete (API.md). */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        courseService.deleteSubtopic(user.id(), id);
    }
}
