package com.ay.revisor.course;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SubtopicRepository extends JpaRepository<Subtopic, Long> {

    Optional<Subtopic> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    List<Subtopic> findAllByTopicIdAndUserIdAndDeletedAtIsNullOrderByIdAsc(Long topicId, Long userId);

    @Modifying(clearAutomatically = true)
    @Query("""
            update Subtopic s set s.deletedAt = :deletedAt
            where s.topicId = :topicId and s.deletedAt is null
            """)
    int softDeleteAllByTopicId(@Param("topicId") Long topicId, @Param("deletedAt") Instant deletedAt);
}
