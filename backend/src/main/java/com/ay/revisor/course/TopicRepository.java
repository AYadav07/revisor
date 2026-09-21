package com.ay.revisor.course;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TopicRepository extends JpaRepository<Topic, Long> {

    Optional<Topic> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);

    List<Topic> findAllByCourseIdAndUserIdAndDeletedAtIsNullOrderByOrderIndexAsc(Long courseId, Long userId);

    List<Topic> findAllByUserIdAndDeletedAtIsNull(Long userId);

    List<Topic> findAllByIdInAndUserIdAndDeletedAtIsNull(Collection<Long> ids, Long userId);
}
