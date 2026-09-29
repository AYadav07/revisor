package com.ay.revisor.shared;

import java.time.Duration;

/**
 * Published by {@code auth} when a verification link should be emailed; handled by {@code notification}
 * after the transaction commits (ARCHITECTURE.md §8). Lives in {@code shared} so neither module depends
 * on the other. The raw token exists only in memory here — the database holds its hash.
 *
 * @param validFor how long the link works, for the "expires in" line of the email
 */
public record EmailVerificationRequested(Long userId, String name, String email, String rawToken, Duration validFor) {

    @Override
    public String toString() { // never let the token or address reach a log line via toString()
        return "EmailVerificationRequested[userId=" + userId + "]";
    }
}
