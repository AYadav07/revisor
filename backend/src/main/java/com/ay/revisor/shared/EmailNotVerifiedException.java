package com.ay.revisor.shared;

/**
 * Correct password, enabled account, but the email address hasn't been verified yet. Maps to 403
 * {@code email-not-verified}. Only thrown after the password check succeeds, so it never reveals an
 * account's existence or state to someone without the password (SECURITY.md).
 */
public class EmailNotVerifiedException extends RuntimeException {

    public EmailNotVerifiedException() {
        super("Verify your email address before signing in. Check your inbox for the link, or request a new one.");
    }
}
