package com.ay.revisor.auth;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.ZoneId;

/**
 * User account management — the seam the admin module calls through, never
 * {@link UserRepository} or {@link RefreshTokenRepository} directly. Signup, login and
 * token issuance live in a separate auth service.
 */
public interface UserService {

    /** All users when {@code query} is blank, otherwise those whose name or email contains it. */
    Page<UserResponse> searchUsers(String query, Pageable pageable);

    /** @throws com.ay.revisor.shared.NotFoundException if no such user */
    UserResponse getUser(Long userId);

    /**
     * The user's own timezone, which is not in the JWT claims, so controllers resolve it here
     * to pass into date-sensitive services.
     *
     * @throws com.ay.revisor.shared.NotFoundException if no such user
     */
    ZoneId getTimezone(Long userId);

    /**
     * Enables or disables the user. Disabling also revokes all of the user's outstanding
     * refresh tokens in the same transaction, so they are logged out everywhere immediately
     * rather than merely blocked at their next refresh (SECURITY.md, ARCHITECTURE.md §7).
     *
     * @throws com.ay.revisor.shared.NotFoundException if no such user
     */
    UserResponse setEnabled(Long userId, boolean enabled, Instant now);

    /**
     * Permanently deletes a user that has already been disabled; the database cascades to
     * their courses, review history and refresh tokens (ARCHITECTURE.md §7).
     *
     * @throws com.ay.revisor.shared.NotFoundException if no such user
     * @throws com.ay.revisor.shared.ConflictException if the user is still enabled
     */
    void deleteUser(Long userId);
}
