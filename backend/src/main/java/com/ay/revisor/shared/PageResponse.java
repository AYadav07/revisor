package com.ay.revisor.shared;

import org.springframework.data.domain.Page;

import java.util.List;

/** The paginated list shape from API.md: {@code { content, page, size, totalElements }}. */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements) {

    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements());
    }
}
