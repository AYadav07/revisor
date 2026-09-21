package com.ay.revisor.admin;

import com.ay.revisor.auth.UserResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;

/**
 * Admin-only operations. Every method records an {@link AdminAction} attributed to
 * {@code adminUserId}; role enforcement ({@code @PreAuthorize("hasRole('ADMIN')")}) is the
 * controller layer's job. Calls other modules only through their service interfaces.
 */
public interface AdminService {

    Page<UserResponse> listUsers(Long adminUserId, String query, Pageable pageable);

    /**
     * @throws com.ay.revisor.shared.ConflictException if an admin tries to disable their own account
     */
    UserResponse setUserEnabled(Long adminUserId, Long targetUserId, boolean enabled, Instant now);

    /**
     * @throws com.ay.revisor.shared.ConflictException if the target is still enabled, or is the admin themselves
     */
    void deleteUser(Long adminUserId, Long targetUserId);

    /** Read-only view of another user's courses with progress. */
    Page<UserCourseProgressResponse> listUserCourses(Long adminUserId, Long targetUserId, Pageable pageable);
}
