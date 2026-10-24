package com.ay.revisor.course;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code onConflict} is optional (null means {@link ConflictResolution#SKIP}) and ignored by course import. */
public record OutlineSubtopic(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 10000) String notes,
        ConflictResolution onConflict
) {
}
