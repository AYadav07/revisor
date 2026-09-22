package com.ay.revisor.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

/** Daily housekeeping — see {@link RefreshTokenRepository#deleteExpiredOrRevoked}. */
@Component
class RefreshTokenCleanupTask {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenCleanupTask.class);

    private final RefreshTokenRepository refreshTokenRepository;
    private final Clock clock;

    RefreshTokenCleanupTask(RefreshTokenRepository refreshTokenRepository, Clock clock) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 3 * * *") // 03:00 server time — low-traffic hour, no user-facing deadline to respect
    @Transactional
    void purgeExpiredOrRevokedTokens() {
        int deleted = refreshTokenRepository.deleteExpiredOrRevoked(clock.instant());
        if (deleted > 0) {
            log.info("Purged {} expired/revoked refresh tokens", deleted);
        }
    }
}
