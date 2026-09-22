package com.ay.revisor.review;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReviewLogRepository extends JpaRepository<ReviewLog, Long> {

    /** {@code id} breaks ties: two reviews can share a {@code reviewed_at}, and the newest must still win. */
    Optional<ReviewLog> findFirstBySubtopicIdAndUserIdOrderByReviewedAtDescIdDesc(Long subtopicId, Long userId);
}
