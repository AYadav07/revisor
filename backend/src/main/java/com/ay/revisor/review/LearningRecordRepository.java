package com.ay.revisor.review;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface LearningRecordRepository extends JpaRepository<LearningRecord, Long> {

    Optional<LearningRecord> findBySubtopicIdAndUserId(Long subtopicId, Long userId);

    @Query("select l.subtopicId from LearningRecord l where l.userId = :userId")
    List<Long> findSubtopicIdsByUserId(@Param("userId") Long userId);
}
