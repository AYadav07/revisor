package com.ay.revisor.shared;

/**
 * The caller, as established from a verified access token. Lives in {@code shared} so any
 * module's controller can take it via {@code @AuthenticationPrincipal} without depending on
 * {@code auth} internals. {@code role} is {@code USER} or {@code ADMIN}.
 */
public record AuthenticatedUser(Long id, String email, String role) {
}
