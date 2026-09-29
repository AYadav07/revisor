package com.ay.revisor.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface EmailTokenRepository extends JpaRepository<EmailToken, Long> {

    Optional<EmailToken> findByTokenHashAndPurpose(String tokenHash, EmailTokenPurpose purpose);

    /**
     * Redeems a token in one conditional update: returns 1 for the caller that consumed it, 0 if it was
     * already used, expired or meant for another purpose. Two concurrent clicks can't both succeed.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update EmailToken t set t.usedAt = :now
            where t.tokenHash = :tokenHash and t.purpose = :purpose
              and t.usedAt is null and t.expiresAt > :now
            """)
    int redeem(@Param("tokenHash") String tokenHash, @Param("purpose") EmailTokenPurpose purpose,
               @Param("now") Instant now);

    /** Retires a user's outstanding tokens of one purpose, so only the newest emailed link works. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update EmailToken t set t.usedAt = :now
            where t.userId = :userId and t.purpose = :purpose and t.usedAt is null
            """)
    int invalidateUnused(@Param("userId") Long userId, @Param("purpose") EmailTokenPurpose purpose,
                         @Param("now") Instant now);

    /** Housekeeping for {@link EmailTokenCleanupTask}: a used or expired token has no further use or audit value. */
    @Modifying(clearAutomatically = true)
    @Query("delete from EmailToken t where t.usedAt is not null or t.expiresAt < :now")
    int deleteUsedOrExpired(@Param("now") Instant now);
}
