package com.ay.revisor.auth;

/** The user shape exposed to clients on signup and login (API.md): no timezone, hash or timestamps. */
public record AuthUserResponse(Long id, String name, String email, Role role) {

    static AuthUserResponse from(UserResponse user) {
        return new AuthUserResponse(user.id(), user.name(), user.email(), user.role());
    }
}
