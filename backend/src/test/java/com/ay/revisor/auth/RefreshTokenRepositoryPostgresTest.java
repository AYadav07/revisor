package com.ay.revisor.auth;

import com.ay.revisor.support.PostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The reuse-detection family revoke and the cleanup purge are bulk @Modifying queries; this checks they
 * actually commit against Postgres. Each runs in its own transaction, as it does in the services, so
 * the assertions afterwards read committed data rather than an uncommitted test transaction.
 */
class RefreshTokenRepositoryPostgresTest extends PostgresIntegrationTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    @Autowired
    private TransactionTemplate transaction;

    private Long userId;

    @AfterEach
    void cleanUp() {
        userRepository.deleteAll();
    }

    @Test
    void revokeAllByFamilyId_revokesEveryTokenInTheFamily_leavingOtherFamiliesAlone() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        UUID family = UUID.randomUUID();
        Long inFamily1 = refreshTokenRepository.save(token(family, "hash-1")).getId();
        Long inFamily2 = refreshTokenRepository.save(token(family, "hash-2")).getId();
        Long otherFamily = refreshTokenRepository.save(token(UUID.randomUUID(), "hash-3")).getId();

        int updated = transaction.execute(status -> refreshTokenRepository.revokeAllByFamilyId(family, Instant.now()));

        assertThat(updated).isEqualTo(2);
        assertThat(refreshTokenRepository.findById(inFamily1)).get().extracting(RefreshToken::getRevokedAt).isNotNull();
        assertThat(refreshTokenRepository.findById(inFamily2)).get().extracting(RefreshToken::getRevokedAt).isNotNull();
        assertThat(refreshTokenRepository.findById(otherFamily)).get().extracting(RefreshToken::getRevokedAt).isNull();
    }

    @Test
    void tokenHash_hasARealUniqueConstraint() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        refreshTokenRepository.save(token(UUID.randomUUID(), "same-hash"));

        assertThatThrownBy(() -> refreshTokenRepository.saveAndFlush(token(UUID.randomUUID(), "same-hash")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void deleteExpiredOrRevoked_removesOnlyUnusableTokens_leavingActiveOnesUntouched() {
        userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        Instant now = Instant.now();
        RefreshToken revokedToken = token(UUID.randomUUID(), "revoked");
        revokedToken.setRevokedAt(now);
        Long revoked = refreshTokenRepository.save(revokedToken).getId();
        Long expired = refreshTokenRepository.save(
                new RefreshToken(userId, UUID.randomUUID(), "expired", now.minusSeconds(1))).getId();
        Long active = refreshTokenRepository.save(token(UUID.randomUUID(), "active")).getId();

        int deleted = transaction.execute(status -> refreshTokenRepository.deleteExpiredOrRevoked(now));

        assertThat(deleted).isEqualTo(2);
        assertThat(refreshTokenRepository.findById(revoked)).isEmpty();
        assertThat(refreshTokenRepository.findById(expired)).isEmpty();
        assertThat(refreshTokenRepository.findById(active)).isPresent();
    }

    private RefreshToken token(UUID family, String hash) {
        return new RefreshToken(userId, family, hash, Instant.now().plusSeconds(3600));
    }
}
