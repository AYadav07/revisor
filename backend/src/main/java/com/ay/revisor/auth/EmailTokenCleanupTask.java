package com.ay.revisor.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

/** Daily housekeeping — see {@link EmailTokenRepository#deleteUsedOrExpired}. */
@Component
class EmailTokenCleanupTask {

    private static final Logger log = LoggerFactory.getLogger(EmailTokenCleanupTask.class);

    private final EmailTokenRepository emailTokenRepository;
    private final Clock clock;

    EmailTokenCleanupTask(EmailTokenRepository emailTokenRepository, Clock clock) {
        this.emailTokenRepository = emailTokenRepository;
        this.clock = clock;
    }

    @Scheduled(cron = "0 15 3 * * *") // just after the refresh-token purge, same low-traffic hour
    @Transactional
    void purgeUsedOrExpiredTokens() {
        int deleted = emailTokenRepository.deleteUsedOrExpired(clock.instant());
        if (deleted > 0) {
            log.info("Purged {} used/expired email tokens", deleted);
        }
    }
}
