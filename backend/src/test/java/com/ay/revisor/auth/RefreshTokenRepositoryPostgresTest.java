package com.ay.revisor.auth;

import com.ay.revisor.support.PostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The reuse-detection family revoke is a bulk @Modifying update; this checks it actually commits against Postgres. */
class RefreshTokenRepositoryPostgresTest extends PostgresIntegrationTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

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

        int updated = refreshTokenRepository.revokeAllByFamilyId(family, Instant.now());

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
        Long revoked = refreshTokenRepository.save(token(UUID.randomUUID(), "revoked")).getId();
        refreshTokenRepository.findById(revoked).orElseThrow().setRevokedAt(now);
        refreshTokenRepository.flush();
        Long expired = refreshTokenRepository.save(
                new RefreshToken(userId, UUID.randomUUID(), "expired", now.minusSeconds(1))).getId();
        Long active = refreshTokenRepository.save(token(UUID.randomUUID(), "active")).getId();

        int deleted = refreshTokenRepository.deleteExpiredOrRevoked(now);

        assertThat(deleted).isEqualTo(2);
        assertThat(refreshTokenRepository.findById(revoked)).isEmpty();
        assertThat(refreshTokenRepository.findById(expired)).isEmpty();
        assertThat(refreshTokenRepository.findById(active)).isPresent();
    }

    private RefreshToken token(UUID family, String hash) {
        return new RefreshToken(userId, family, hash, Instant.now().plusSeconds(3600));
    }
}
