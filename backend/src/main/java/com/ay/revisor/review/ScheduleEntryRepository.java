package com.ay.revisor.review;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface ScheduleEntryRepository extends JpaRepository<ScheduleEntry, Long> {

    Optional<ScheduleEntry> findBySubtopicIdAndUserId(Long subtopicId, Long userId);

    Page<ScheduleEntry> findAllByUserIdAndNextReviewDateLessThanEqualOrderByNextReviewDateAsc(
            Long userId, LocalDate onOrBefore, Pageable pageable);
}
