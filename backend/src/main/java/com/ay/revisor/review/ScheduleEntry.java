package com.ay.revisor.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "schedule_entry")
public class ScheduleEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "subtopic_id", nullable = false, unique = true)
    private Long subtopicId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "next_review_date", nullable = false)
    private LocalDate nextReviewDate;

    protected ScheduleEntry() {
    }

    public ScheduleEntry(Long subtopicId, Long userId, LocalDate nextReviewDate) {
        this.subtopicId = subtopicId;
        this.userId = userId;
        this.nextReviewDate = nextReviewDate;
    }

    public Long getId() {
        return id;
    }

    public Long getSubtopicId() {
        return subtopicId;
    }

    public Long getUserId() {
        return userId;
    }

    public LocalDate getNextReviewDate() {
        return nextReviewDate;
    }

    public void setNextReviewDate(LocalDate nextReviewDate) {
        this.nextReviewDate = nextReviewDate;
    }
}
