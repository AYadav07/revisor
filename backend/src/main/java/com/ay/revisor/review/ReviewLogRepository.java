package com.ay.revisor.review;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReviewLogRepository extends JpaRepository<ReviewLog, Long> {

    Optional<ReviewLog> findFirstBySubtopicIdAndUserIdOrderByReviewedAtDesc(Long subtopicId, Long userId);
}
