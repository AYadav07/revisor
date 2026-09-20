package com.ay.revisor.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "review_log")
public class ReviewLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "subtopic_id", nullable = false)
    private Long subtopicId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "reviewed_at", nullable = false)
    private Instant reviewedAt;

    @Column(nullable = false)
    private int quality;

    @Column(name = "ease_factor", nullable = false, precision = 4, scale = 2)
    private BigDecimal easeFactor;

    @Column(name = "interval_days", nullable = false)
    private int intervalDays;

    @Column(name = "repetition_count", nullable = false)
    private int repetitionCount;

    protected ReviewLog() {
    }

    public ReviewLog(Long subtopicId, Long userId, Instant reviewedAt, int quality,
                      BigDecimal easeFactor, int intervalDays, int repetitionCount) {
        this.subtopicId = subtopicId;
        this.userId = userId;
        this.reviewedAt = reviewedAt;
        this.quality = quality;
        this.easeFactor = easeFactor;
        this.intervalDays = intervalDays;
        this.repetitionCount = repetitionCount;
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

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public int getQuality() {
        return quality;
    }

    public BigDecimal getEaseFactor() {
        return easeFactor;
    }

    public int getIntervalDays() {
        return intervalDays;
    }

    public int getRepetitionCount() {
        return repetitionCount;
    }
}
