package com.ay.revisor.review;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LearningRecordRepository extends JpaRepository<LearningRecord, Long> {

    Optional<LearningRecord> findBySubtopicIdAndUserId(Long subtopicId, Long userId);
}
