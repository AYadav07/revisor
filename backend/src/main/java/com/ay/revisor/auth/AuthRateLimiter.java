package com.ay.revisor.auth;

import com.ay.revisor.shared.TooManyRequestsException;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.TimeMeter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;

/**
 * Brute-force, account-farming and email-spam limits (SECURITY.md): 5 login attempts per email per
 * 15 minutes, 10 signups per IP per hour, 3 emails of each kind per address per hour (and 10 per IP),
 * 20 link redemptions per IP per hour. In-memory, which is correct for the single backend instance this app
 * runs as (DEPLOYMENT.md) — a second instance would need a shared store.
 * <p>
 * Buckets live in size-bounded, expiring caches, so an attacker cycling through emails or IPs cannot
 * grow memory without limit. Every attempt counts, successful or not.
 */
@Component
class AuthRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(AuthRateLimiter.class);

    static final int LOGIN_ATTEMPTS = 5;
    static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    static final int SIGNUP_ATTEMPTS = 10;
    static final Duration SIGNUP_WINDOW = Duration.ofHours(1);
    static final int EMAIL_SENDS_PER_ADDRESS = 3;
    static final int EMAIL_SENDS_PER_IP = 10;
    static final Duration EMAIL_SEND_WINDOW = Duration.ofHours(1);
    static final int TOKEN_REDEMPTIONS_PER_IP = 20;
    static final Duration TOKEN_REDEMPTION_WINDOW = Duration.ofHours(1);
    private static final long MAX_TRACKED_KEYS = 100_000;

    private final TimeMeter timeMeter;
    private final Cache<String, Bucket> loginBuckets = newCache(LOGIN_WINDOW);
    private final Cache<String, Bucket> signupBuckets = newCache(SIGNUP_WINDOW);
    private final Cache<String, Bucket> emailSendByAddressBuckets = newCache(EMAIL_SEND_WINDOW);
    private final Cache<String, Bucket> emailSendByIpBuckets = newCache(EMAIL_SEND_WINDOW);
    private final Cache<String, Bucket> tokenRedemptionBuckets = newCache(TOKEN_REDEMPTION_WINDOW);

    AuthRateLimiter() {
        this(TimeMeter.SYSTEM_NANOTIME);
    }

    /** For tests, which need to control time. */
    AuthRateLimiter(TimeMeter timeMeter) {
        this.timeMeter = timeMeter;
    }

    /** @throws TooManyRequestsException once an email has used its login attempts for the window */
    void checkLogin(String email) {
        // The email is the bucket key, but stays out of the log (SECURITY.md, "Logging discipline").
        consume(loginBuckets, email.trim().toLowerCase(Locale.ROOT), LOGIN_ATTEMPTS, LOGIN_WINDOW, "Login rate limit hit");
    }

    /** @throws TooManyRequestsException once an IP address has used its signups for the window */
    void checkSignup(String clientIp) {
        consume(signupBuckets, clientIp, SIGNUP_ATTEMPTS, SIGNUP_WINDOW, "Signup rate limit hit from " + clientIp);
    }

    /**
     * Limits requests that make us send an email ({@code kind} is e.g. "verify" or "reset", counted
     * separately), per address and per IP — protecting inboxes from spam and the provider's free quota.
     *
     * @throws TooManyRequestsException once either limit is used up for the window
     */
    void checkEmailSend(String kind, String email, String clientIp) {
        consume(emailSendByIpBuckets, kind + ":" + clientIp, EMAIL_SENDS_PER_IP, EMAIL_SEND_WINDOW,
                "Email-send rate limit (" + kind + ") hit from " + clientIp);
        // The address is a bucket key only; it stays out of the log.
        consume(emailSendByAddressBuckets, kind + ":" + email.trim().toLowerCase(Locale.ROOT), EMAIL_SENDS_PER_ADDRESS,
                EMAIL_SEND_WINDOW, "Email-send rate limit (" + kind + ") hit for one address");
    }

    /** @throws TooManyRequestsException once an IP address has redeemed too many email links for the window */
    void checkTokenRedemption(String clientIp) {
        consume(tokenRedemptionBuckets, clientIp, TOKEN_REDEMPTIONS_PER_IP, TOKEN_REDEMPTION_WINDOW,
                "Token redemption rate limit hit from " + clientIp);
    }

    /** Forgets all state. Tests only. */
    void clear() {
        loginBuckets.invalidateAll();
        signupBuckets.invalidateAll();
        emailSendByAddressBuckets.invalidateAll();
        emailSendByIpBuckets.invalidateAll();
        tokenRedemptionBuckets.invalidateAll();
    }

    private void consume(Cache<String, Bucket> buckets, String key, int attempts, Duration window, String logMessage) {
        Bucket bucket = buckets.get(key, k -> Bucket.builder()
                .addLimit(limit -> limit.capacity(attempts).refillIntervally(attempts, window))
                .withCustomTimePrecision(timeMeter)
                .build());
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (!probe.isConsumed()) {
            long seconds = Math.max(1, (probe.getNanosToWaitForRefill() + 999_999_999L) / 1_000_000_000L);
            log.warn(logMessage);
            throw new TooManyRequestsException(seconds);
        }
    }

    private static Cache<String, Bucket> newCache(Duration window) {
        return Caffeine.newBuilder().maximumSize(MAX_TRACKED_KEYS).expireAfterAccess(window).build();
    }
}
