package com.ay.revisor.review;

import java.time.LocalDate;

public record DueSubtopic(Long subtopicId, LocalDate nextReviewDate) {
}
