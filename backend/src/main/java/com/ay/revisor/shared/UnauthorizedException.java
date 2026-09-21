package com.ay.revisor.shared;

/**
 * Authentication failed: bad credentials, or a refresh token that is unknown, expired,
 * revoked or belongs to a disabled user. Maps to 401 at the controller layer. Messages are
 * deliberately generic so callers can't tell "no such account" from "wrong password".
 */
public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String message) {
        super(message);
    }
}
