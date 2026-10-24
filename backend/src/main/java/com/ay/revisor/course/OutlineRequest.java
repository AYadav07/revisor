package com.ay.revisor.course;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Body of {@code POST /courses/{id}/outline}: topics and subtopics to add to an existing course. */
public record OutlineRequest(
        @NotNull @Size(min = 1, max = OutlineMerger.MAX_TOPICS) List<@Valid @NotNull OutlineTopic> topics
) {
}
