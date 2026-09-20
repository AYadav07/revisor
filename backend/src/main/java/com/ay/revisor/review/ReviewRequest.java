package com.ay.revisor.review;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ReviewRequest(@NotNull @Min(0) @Max(5) Integer quality) {
}
