package com.ay.revisor.auth;

import com.ay.revisor.shared.ConflictException;
import com.ay.revisor.shared.UnauthorizedException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
class AuthServiceImpl implements AuthService {

    static final Duration REFRESH_TOKEN_TTL = Duration.ofDays(14);

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper mapper;
    /** Matched against when the email is unknown, so "no such user" costs the same as "wrong password". */
    private final String dummyPasswordHash;

    AuthServiceImpl(UserRepository userRepository, RefreshTokenRepository refreshTokenRepository,
                     PasswordEncoder passwordEncoder, UserMapper mapper) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.mapper = mapper;
        this.dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Override
    public UserResponse signup(SignupRequest request) {
        String email = normalize(request.email());
        if (userRepository.existsByEmail(email)) {
            throw emailTaken();
        }
        User user = new User(request.name().trim(), email, passwordEncoder.encode(request.password()),
                Role.USER, true, request.timezone());
        try {
            return mapper.toResponse(userRepository.saveAndFlush(user));
        } catch (DataIntegrityViolationException e) {
            throw emailTaken(); // lost a race with a concurrent signup for the same email
        }
    }

    @Override
    public AuthResult login(LoginRequest request, Instant now) {
        User user = userRepository.findByEmail(normalize(request.email())).orElse(null);
        String hashToCheck = user == null ? dummyPasswordHash : user.getPasswordHash();
        boolean passwordMatches = passwordEncoder.matches(request.password(), hashToCheck);
        if (user == null || !passwordMatches || !user.isEnabled()) {
            throw new UnauthorizedException("Invalid credentials");
        }
        return issueToken(user, UUID.randomUUID(), now);
    }

    /**
     * {@code noRollbackFor}: reuse detection revokes the family and then throws. Without it the
     * exception would roll the revocation back, leaving a stolen token family fully usable.
     */
    @Override
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public AuthResult refresh(String refreshToken, Instant now) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new UnauthorizedException("Invalid refresh token");
        }
        RefreshToken token = refreshTokenRepository.findByTokenHash(OpaqueTokens.hash(refreshToken))
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (token.getRevokedAt() != null) {
            refreshTokenRepository.revokeAllByFamilyId(token.getFamilyId(), now);
            throw new UnauthorizedException("Invalid refresh token");
        }
        if (!token.getExpiresAt().isAfter(now)) {
            throw new UnauthorizedException("Invalid refresh token");
        }
        User user = userRepository.findById(token.getUserId())
                .filter(User::isEnabled)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        token.setRevokedAt(now);
        return issueToken(user, token.getFamilyId(), now);
    }

    @Override
    public void logout(String refreshToken, Instant now) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(OpaqueTokens.hash(refreshToken))
                .ifPresent(token -> refreshTokenRepository.revokeAllByFamilyId(token.getFamilyId(), now));
    }

    private AuthResult issueToken(User user, UUID familyId, Instant now) {
        String rawToken = OpaqueTokens.generate();
        Instant expiresAt = now.plus(REFRESH_TOKEN_TTL);
        refreshTokenRepository.save(new RefreshToken(user.getId(), familyId, OpaqueTokens.hash(rawToken), expiresAt));
        return new AuthResult(mapper.toResponse(user), rawToken, expiresAt);
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static ConflictException emailTaken() {
        return new ConflictException("An account with this email already exists");
    }
}
