package com.ay.revisor.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findAllByFamilyId(UUID familyId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update RefreshToken r set r.revokedAt = :revokedAt
            where r.familyId = :familyId and r.revokedAt is null
            """)
    int revokeAllByFamilyId(@Param("familyId") UUID familyId, @Param("revokedAt") Instant revokedAt);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update RefreshToken r set r.revokedAt = :revokedAt
            where r.userId = :userId and r.revokedAt is null
            """)
    int revokeAllByUserId(@Param("userId") Long userId, @Param("revokedAt") Instant revokedAt);

    /**
     * Housekeeping for {@link RefreshTokenCleanupTask}: a revoked or expired token is no longer
     * usable for anything (not even reuse-detection needs the row once it's expired), so nothing
     * observable changes by deleting it — this is pure table-size hygiene, not a security or
     * audit concern like {@code AdminAction}'s retention.
     */
    @Modifying(clearAutomatically = true)
    @Query("delete from RefreshToken r where r.revokedAt is not null or r.expiresAt < :now")
    int deleteExpiredOrRevoked(@Param("now") Instant now);
}
