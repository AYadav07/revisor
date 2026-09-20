package com.ay.revisor.course;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CourseRequest(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 2000) String description
) {
}
