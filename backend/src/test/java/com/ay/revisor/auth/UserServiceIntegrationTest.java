package com.ay.revisor.auth;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs against the in-memory H2 database (default {@code local} profile). Exists because
 * disabling a user interleaves a JPA update with a bulk revoke that clears the persistence
 * context — an interaction mocked-repository tests cannot exercise.
 */
@SpringBootTest
class UserServiceIntegrationTest {

    @Autowired
    private UserService userService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @AfterEach
    void cleanUp() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void disablingUser_persistsDisabledFlagAndRevokesEveryOutstandingToken() {
        Long userId = userRepository.save(new User("Ann", "ann@example.com", "hash", Role.USER, true, "UTC")).getId();
        refreshTokenRepository.save(new RefreshToken(userId, UUID.randomUUID(), "hash-1", Instant.now().plusSeconds(3600)));
        refreshTokenRepository.save(new RefreshToken(userId, UUID.randomUUID(), "hash-2", Instant.now().plusSeconds(3600)));

        userService.setEnabled(userId, false, Instant.now());

        assertThat(userRepository.findById(userId)).get().extracting(User::isEnabled).isEqualTo(false);
        assertThat(refreshTokenRepository.findAll()).hasSize(2).allSatisfy(token -> assertThat(token.getRevokedAt()).isNotNull());
    }

    @Test
    void deletingDisabledUser_cascadesToTheirRefreshTokens() {
        Long userId = userRepository.save(new User("Bob", "bob@example.com", "hash", Role.USER, false, "UTC")).getId();
        refreshTokenRepository.save(new RefreshToken(userId, UUID.randomUUID(), "hash-3", Instant.now().plusSeconds(3600)));

        userService.deleteUser(userId);

        assertThat(userRepository.findById(userId)).isEmpty();
        assertThat(refreshTokenRepository.findAll()).isEmpty();
    }
}
