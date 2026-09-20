package com.ay.revisor.review;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ReviewResponse(
        Long subtopicId,
        BigDecimal easeFactor,
        int intervalDays,
        LocalDate nextReviewDate,
        int repetitionCount
) {
}
