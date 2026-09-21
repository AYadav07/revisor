package com.ay.revisor.auth;

import com.ay.revisor.shared.ConflictException;
import com.ay.revisor.shared.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@Transactional
class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserMapper mapper;

    UserServiceImpl(UserRepository userRepository, RefreshTokenRepository refreshTokenRepository,
                     UserMapper mapper) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.mapper = mapper;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserResponse> searchUsers(String query, Pageable pageable) {
        Page<User> users = (query == null || query.isBlank())
                ? userRepository.findAll(pageable)
                : userRepository.search(query.trim(), pageable);
        return users.map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUser(Long userId) {
        return mapper.toResponse(findUser(userId));
    }

    @Override
    public UserResponse setEnabled(Long userId, boolean enabled, Instant now) {
        User user = findUser(userId);
        user.setEnabled(enabled);
        if (!enabled) {
            // The bulk revoke below clears the persistence context, which would silently discard
            // this not-yet-flushed change — so flush it first.
            userRepository.saveAndFlush(user);
            refreshTokenRepository.revokeAllByUserId(userId, now);
        }
        return mapper.toResponse(user);
    }

    @Override
    public void deleteUser(Long userId) {
        User user = findUser(userId);
        if (user.isEnabled()) {
            throw new ConflictException("User " + userId + " must be disabled before it can be deleted");
        }
        userRepository.delete(user);
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> NotFoundException.of("User", userId));
    }
}
