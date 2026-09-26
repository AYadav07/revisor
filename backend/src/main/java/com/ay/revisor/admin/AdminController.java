package com.ay.revisor.admin;

import com.ay.revisor.auth.UserResponse;
import com.ay.revisor.shared.AuthenticatedUser;
import com.ay.revisor.shared.PageResponse;
import com.ay.revisor.shared.Paging;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;

/**
 * Admin-only user management and read-only cross-user views (API.md). Every operation is
 * recorded in the admin action log by {@link AdminService}. Non-admins get 403 — the one place
 * the API answers 403 rather than 404, because the endpoints themselves are not secret.
 */
@Tag(name = "Admin", description = "ADMIN role only (403 otherwise). Every call is written to the admin action log.")
@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
class AdminController {

    private final AdminService adminService;
    private final Clock clock;

    AdminController(AdminService adminService, Clock clock) {
        this.adminService = adminService;
        this.clock = clock;
    }

    /** {@code q} matches name or email, case-insensitively; omit it to list everyone. */
    @Operation(summary = "List or search users", description = "q matches name or email, case-insensitively.")
    @GetMapping
    PageResponse<UserResponse> list(@AuthenticationPrincipal AuthenticatedUser admin,
                                     @RequestParam(required = false) String q,
                                     @RequestParam(defaultValue = "0") @Min(0) int page,
                                     @RequestParam(defaultValue = Paging.DEFAULT_SIZE) @Min(1) @Max(Paging.MAX_SIZE) int size) {
        return PageResponse.from(adminService.listUsers(admin.id(), q, PageRequest.of(page, size, Sort.by("id"))));
    }

    /** Disabling also revokes the user's refresh tokens, logging them out everywhere. */
    @Operation(summary = "Enable or disable a user", description = "Disabling revokes all their refresh tokens. 409 if an admin targets themselves.")
    @PatchMapping("/{id}")
    UserResponse setEnabled(@AuthenticationPrincipal AuthenticatedUser admin, @PathVariable Long id,
                            @Valid @RequestBody UpdateUserRequest request) {
        return adminService.setUserEnabled(admin.id(), id, request.enabled(), clock.instant());
    }

    /** 409 unless the user is already disabled; then permanently removes them and all their data. */
    @Operation(summary = "Delete a user", description = "409 unless already disabled, or if an admin targets themselves. Permanently removes all their data.")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal AuthenticatedUser admin, @PathVariable Long id) {
        adminService.deleteUser(admin.id(), id);
    }

    @Operation(summary = "View a user's courses and progress", description = "Read-only.")
    @GetMapping("/{id}/courses")
    PageResponse<UserCourseProgressResponse> courses(@AuthenticationPrincipal AuthenticatedUser admin,
                                                      @PathVariable Long id,
                                                      @RequestParam(defaultValue = "0") @Min(0) int page,
                                                      @RequestParam(defaultValue = Paging.DEFAULT_SIZE) @Min(1) @Max(Paging.MAX_SIZE) int size) {
        return PageResponse.from(adminService.listUserCourses(admin.id(), id,
                PageRequest.of(page, size, Sort.by("id"))));
    }
}
