package com.ay.revisor.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenCleanupTaskTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Test
    void purge_deletesUsingTheCurrentInstantFromTheInjectedClock() {
        Instant now = Instant.parse("2026-09-23T03:00:00Z");
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        when(refreshTokenRepository.deleteExpiredOrRevoked(now)).thenReturn(3);

        new RefreshTokenCleanupTask(refreshTokenRepository, clock).purgeExpiredOrRevokedTokens();

        verify(refreshTokenRepository).deleteExpiredOrRevoked(now);
    }
}
