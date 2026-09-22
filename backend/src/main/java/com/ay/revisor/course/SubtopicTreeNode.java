package com.ay.revisor.course;

import java.time.LocalDate;

/** {@code nextReviewDate} is null exactly when {@code learned} is false. */
public record SubtopicTreeNode(Long id, String title, String notes, boolean learned, LocalDate nextReviewDate) {
}
