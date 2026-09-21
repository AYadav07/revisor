package com.ay.revisor.auth;

import java.time.Instant;

/** Safe view of a {@link User} — deliberately has no password hash. */
public record UserResponse(
        Long id,
        String name,
        String email,
        Role role,
        boolean enabled,
        String timezone,
        Instant createdAt
) {
}
