package com.ay.revisor.course;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record TopicRequest(
        @NotBlank @Size(max = 255) String title,
        @NotNull Integer orderIndex
) {
}
