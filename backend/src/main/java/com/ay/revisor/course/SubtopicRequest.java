package com.ay.revisor.course;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubtopicRequest(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 10000) String notes
) {
}
