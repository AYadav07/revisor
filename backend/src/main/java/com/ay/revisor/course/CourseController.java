package com.ay.revisor.course;

import com.ay.revisor.shared.AuthenticatedUser;
import com.ay.revisor.shared.PageResponse;
import com.ay.revisor.shared.Paging;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Courses", description = "The caller's own courses. Someone else's course is a 404, never a 403.")
@RestController
@RequestMapping("/api/v1/courses")
class CourseController {

    private final CourseService courseService;
    private final CourseTreeAssembler treeAssembler;

    CourseController(CourseService courseService, CourseTreeAssembler treeAssembler) {
        this.courseService = courseService;
        this.treeAssembler = treeAssembler;
    }

    @Operation(summary = "Create a course")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    CourseResponse create(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody CourseRequest request) {
        return courseService.createCourse(user.id(), request);
    }

    @Operation(summary = "List courses", description = "Paginated, oldest first.")
    @GetMapping
    PageResponse<CourseResponse> list(@AuthenticationPrincipal AuthenticatedUser user,
                                       @RequestParam(defaultValue = "0") @Min(0) int page,
                                       @RequestParam(defaultValue = Paging.DEFAULT_SIZE) @Min(1) @Max(Paging.MAX_SIZE) int size) {
        return PageResponse.from(courseService.listCourses(user.id(), PageRequest.of(page, size, Sort.by("id"))));
    }

    @Operation(summary = "Get a course with its topics and subtopics", description = "The whole tree in one response, including each subtopic's review state.")
    @GetMapping("/{id}")
    CourseTreeResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return treeAssembler.assemble(user.id(), id);
    }

    @Operation(summary = "Update a course")
    @PutMapping("/{id}")
    CourseResponse update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                          @Valid @RequestBody CourseRequest request) {
        return courseService.updateCourse(user.id(), id, request);
    }

    @Operation(summary = "Delete a course", description = "Removes its topics, subtopics and review history.")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        courseService.deleteCourse(user.id(), id);
    }

    @Operation(summary = "Add a topic to a course")
    @PostMapping("/{id}/topics")
    @ResponseStatus(HttpStatus.CREATED)
    TopicResponse createTopic(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                              @Valid @RequestBody TopicRequest request) {
        return courseService.createTopic(user.id(), id, request);
    }
}
