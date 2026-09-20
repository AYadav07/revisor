package com.ay.revisor.course;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CourseRepository extends JpaRepository<Course, Long> {

    Optional<Course> findByIdAndUserId(Long id, Long userId);

    Page<Course> findAllByUserId(Long userId, Pageable pageable);
}
