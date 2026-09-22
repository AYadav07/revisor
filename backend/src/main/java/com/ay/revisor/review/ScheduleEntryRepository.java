package com.ay.revisor.review;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ScheduleEntryRepository extends JpaRepository<ScheduleEntry, Long> {

    Optional<ScheduleEntry> findBySubtopicIdAndUserId(Long subtopicId, Long userId);

    List<ScheduleEntry> findAllByUserIdAndSubtopicIdIn(Long userId, Collection<Long> subtopicIds);

    long countByUserIdAndNextReviewDateAndSubtopicIdIn(Long userId, LocalDate date, Collection<Long> subtopicIds);

    long countByUserIdAndNextReviewDateLessThanAndSubtopicIdIn(Long userId, LocalDate before, Collection<Long> subtopicIds);

    Page<ScheduleEntry> findAllByUserIdAndNextReviewDateLessThanEqualAndSubtopicIdInOrderByNextReviewDateAscIdAsc(
            Long userId, LocalDate onOrBefore, Collection<Long> subtopicIds, Pageable pageable);
}
