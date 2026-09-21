package com.ay.revisor.auth;

import com.ay.revisor.shared.ConflictException;
import com.ay.revisor.shared.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    private static final Long USER_ID = 5L;
    private static final Instant NOW = Instant.parse("2026-09-22T10:00:00Z");
    private static final Pageable PAGE = PageRequest.of(0, 20);

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private UserServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(userRepository, refreshTokenRepository, new UserMapperImpl());
    }

    @Test
    void searchUsers_listsEveryoneWhenQueryIsBlank() {
        when(userRepository.findAll(PAGE)).thenReturn(new PageImpl<>(List.of(user(true)), PAGE, 1));

        assertThat(service.searchUsers("  ", PAGE).getContent()).hasSize(1);
        verify(userRepository, never()).search(any(), any());
    }

    @Test
    void searchUsers_usesTrimmedQueryWhenProvided() {
        when(userRepository.search("ann", PAGE)).thenReturn(new PageImpl<>(List.of(user(true)), PAGE, 1));

        assertThat(service.searchUsers(" ann ", PAGE).getContent()).hasSize(1);
    }

    @Test
    void getUser_neverExposesPasswordHash() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(true)));

        UserResponse response = service.getUser(USER_ID);

        assertThat(response.email()).isEqualTo("ann@example.com");
        assertThat(UserResponse.class.getRecordComponents()).extracting("name").doesNotContain("passwordHash");
    }

    @Test
    void getUser_throwsNotFound_whenMissing() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getUser(USER_ID)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void getTimezone_returnsTheUsersZoneId() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(true)));

        assertThat(service.getTimezone(USER_ID)).isEqualTo(java.time.ZoneId.of("Asia/Kolkata"));
    }

    @Test
    void getTimezone_throwsNotFound_whenMissing() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getTimezone(USER_ID)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void setEnabled_false_revokesAllOfTheirTokens() {
        User user = user(true);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        UserResponse response = service.setEnabled(USER_ID, false, NOW);

        assertThat(response.enabled()).isFalse();
        verify(refreshTokenRepository).revokeAllByUserId(USER_ID, NOW);
    }

    @Test
    void setEnabled_true_doesNotTouchRefreshTokens() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(false)));

        UserResponse response = service.setEnabled(USER_ID, true, NOW);

        assertThat(response.enabled()).isTrue();
        verify(refreshTokenRepository, never()).revokeAllByUserId(any(), any());
    }

    @Test
    void deleteUser_throwsConflict_whenUserStillEnabled() {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user(true)));

        assertThatThrownBy(() -> service.deleteUser(USER_ID)).isInstanceOf(ConflictException.class);
        verify(userRepository, never()).delete(any());
    }

    @Test
    void deleteUser_deletesUser_whenAlreadyDisabled() {
        User disabled = user(false);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(disabled));

        service.deleteUser(USER_ID);

        verify(userRepository).delete(disabled);
    }

    private static User user(boolean enabled) {
        User user = new User("Ann", "ann@example.com", "hash", Role.USER, enabled, "Asia/Kolkata");
        ReflectionTestUtils.setField(user, "id", USER_ID);
        return user;
    }
}
