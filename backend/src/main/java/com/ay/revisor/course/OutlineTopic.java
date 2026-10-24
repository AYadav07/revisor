package com.ay.revisor.course;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** A topic may come with no subtopics; a null list is treated as empty. */
public record OutlineTopic(
        @NotBlank @Size(max = 255) String title,
        @Size(max = OutlineMerger.MAX_SUBTOPICS) List<@Valid @NotNull OutlineSubtopic> subtopics
) {

    public OutlineTopic {
        subtopics = subtopics == null ? List.of() : subtopics;
    }
}
