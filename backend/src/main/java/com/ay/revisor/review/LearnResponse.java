package com.ay.revisor.review;

import java.time.Instant;
import java.time.LocalDate;

public record LearnResponse(Long subtopicId, Instant learnedAt, LocalDate nextReviewDate) {
}
