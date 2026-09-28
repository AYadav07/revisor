package com.ay.revisor.auth;

import com.ay.revisor.support.PostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Token redemption is a conditional bulk update — the whole single-use guarantee rests on it, so it is
 * checked against real Postgres. Each call runs in its own transaction, as in the service.
 */
class EmailTokenRepositoryPostgresTest extends PostgresIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-09-29T10:00:00Z");

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private EmailTokenRepository emailTokenRepository;
    @Autowired
    private TransactionTemplate transaction;

    @AfterEach
    void cleanUp() {
        userRepository.deleteAll();
    }

    @Test
    void redeem_succeedsExactlyOnce_andOnlyForTheRightPurposeBeforeExpiry() {
        Long userId = newUser();
        emailTokenRepository.save(new EmailToken(userId, EmailTokenPurpose.VERIFY_EMAIL, "hash-1", NOW.plusSeconds(60)));
        emailTokenRepository.save(new EmailToken(userId, EmailTokenPurpose.VERIFY_EMAIL, "hash-expired", NOW));

        assertThat(redeem("hash-1", EmailTokenPurpose.RESET_PASSWORD)).isZero();
        assertThat(redeem("hash-1", EmailTokenPurpose.VERIFY_EMAIL)).isEqualTo(1);
        assertThat(redeem("hash-1", EmailTokenPurpose.VERIFY_EMAIL)).isZero();
        assertThat(redeem("hash-expired", EmailTokenPurpose.VERIFY_EMAIL)).isZero();
    }

    @Test
    void invalidateUnused_retiresOnlyThatUsersOutstandingTokensOfThatPurpose() {
        Long userId = newUser();
        emailTokenRepository.save(new EmailToken(userId, EmailTokenPurpose.VERIFY_EMAIL, "verify", NOW.plusSeconds(60)));
        emailTokenRepository.save(new EmailToken(userId, EmailTokenPurpose.RESET_PASSWORD, "reset", NOW.plusSeconds(60)));

        int retired = transaction.execute(status ->
                emailTokenRepository.invalidateUnused(userId, EmailTokenPurpose.VERIFY_EMAIL, NOW));

        assertThat(retired).isEqualTo(1);
        assertThat(redeem("verify", EmailTokenPurpose.VERIFY_EMAIL)).isZero();
        assertThat(redeem("reset", EmailTokenPurpose.RESET_PASSWORD)).isEqualTo(1);
    }

    @Test
    void deleteUsedOrExpired_keepsLiveTokens_andDeletingTheUserCascades() {
        Long userId = newUser();
        emailTokenRepository.save(new EmailToken(userId, EmailTokenPurpose.VERIFY_EMAIL, "live", NOW.plusSeconds(60)));
        emailTokenRepository.save(new EmailToken(userId, EmailTokenPurpose.VERIFY_EMAIL, "expired", NOW.minusSeconds(1)));

        int deleted = transaction.execute(status -> emailTokenRepository.deleteUsedOrExpired(NOW));

        assertThat(deleted).isEqualTo(1);
        assertThat(emailTokenRepository.findAll()).extracting(EmailToken::getTokenHash).containsExactly("live");
        userRepository.deleteById(userId);
        assertThat(emailTokenRepository.count()).isZero();
    }

    @Test
    void newUsersStartUnverified() {
        Long userId = newUser();
        assertThat(userRepository.findById(userId)).get().extracting(User::isEmailVerified).isEqualTo(false);
    }

    private int redeem(String hash, EmailTokenPurpose purpose) {
        return transaction.execute(status -> emailTokenRepository.redeem(hash, purpose, NOW));
    }

    private Long newUser() {
        return userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
    }
}
