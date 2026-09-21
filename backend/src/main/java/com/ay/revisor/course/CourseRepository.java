package com.ay.revisor.course;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CourseRepository extends JpaRepository<Course, Long> {

    Optional<Course> findByIdAndUserId(Long id, Long userId);

    Page<Course> findAllByUserId(Long userId, Pageable pageable);

    List<Course> findAllByUserIdOrderByIdAsc(Long userId);

    List<Course> findAllByIdInAndUserId(Collection<Long> ids, Long userId);
}
