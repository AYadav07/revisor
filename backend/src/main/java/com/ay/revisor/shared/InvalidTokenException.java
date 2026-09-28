package com.ay.revisor.shared;

/**
 * An email verification or password reset token is unknown, expired, already used, meant for the
 * other purpose, or belongs to a disabled account. Maps to 400 {@code invalid-token}; the cases are
 * deliberately indistinguishable to the caller.
 */
public class InvalidTokenException extends RuntimeException {

    public InvalidTokenException() {
        super("This link is invalid or has expired. Request a new one.");
    }
}
