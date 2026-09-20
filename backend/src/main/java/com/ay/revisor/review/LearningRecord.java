package com.ay.revisor.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "learning_record")
public class LearningRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "subtopic_id", nullable = false, unique = true)
    private Long subtopicId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "learned_at", nullable = false)
    private Instant learnedAt;

    protected LearningRecord() {
    }

    public LearningRecord(Long subtopicId, Long userId, Instant learnedAt) {
        this.subtopicId = subtopicId;
        this.userId = userId;
        this.learnedAt = learnedAt;
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

    public Instant getLearnedAt() {
        return learnedAt;
    }
}
