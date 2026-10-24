package com.ay.revisor.course;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Body of {@code POST /courses/import}: a new course with its whole tree. */
public record CourseImportRequest(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 2000) String description,
        @NotNull @Size(min = 1, max = OutlineMerger.MAX_TOPICS) List<@Valid @NotNull OutlineTopic> topics
) {
}
