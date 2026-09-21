package com.ay.revisor.auth;

import com.ay.revisor.shared.AuthenticatedUser;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** Issuer and verifier are tested together, plus the forgeries the verifier must refuse. */
class AccessTokenTest {

    private static final Instant NOW = Instant.parse("2026-09-22T10:00:00Z");

    private JwtKeys keys;
    private AccessTokenIssuer issuer;
    private AccessTokenVerifier verifier;

    @BeforeEach
    void setUp() throws Exception {
        keys = newKeys();
        issuer = new AccessTokenIssuer(keys);
        verifier = new AccessTokenVerifier(keys);
    }

    @Test
    void roundTrip_carriesUserIdEmailAndRole() {
        String token = issuer.issue(user(Role.ADMIN), NOW);

        assertThat(verifier.verify(token, NOW.plusSeconds(60)))
                .contains(new AuthenticatedUser(5L, "ann@example.com", "ADMIN"));
    }

    @Test
    void claimsAreMinimal_subEmailRoleIatExpOnly() throws Exception {
        JWTClaimsSet claims = SignedJWT.parse(issuer.issue(user(Role.USER), NOW)).getJWTClaimsSet();

        assertThat(claims.getClaims().keySet()).containsExactlyInAnyOrder("sub", "email", "role", "iat", "exp");
        assertThat(claims.getExpirationTime().toInstant()).isEqualTo(NOW.plus(AccessTokenIssuer.ACCESS_TOKEN_TTL));
    }

    @Test
    void expiresAfterFifteenMinutes() {
        String token = issuer.issue(user(Role.USER), NOW);

        assertThat(verifier.verify(token, NOW.plus(AccessTokenIssuer.ACCESS_TOKEN_TTL).minusSeconds(1))).isPresent();
        assertThat(verifier.verify(token, NOW.plus(AccessTokenIssuer.ACCESS_TOKEN_TTL))).isEmpty();
    }

    @Test
    void rejectsTokenSignedByADifferentKey() throws Exception {
        String foreign = new AccessTokenIssuer(newKeys()).issue(user(Role.ADMIN), NOW);

        assertThat(verifier.verify(foreign, NOW)).isEmpty();
    }

    @Test
    void rejectsTamperedPayload_evenWithAValidLookingSignature() {
        String[] parts = issuer.issue(user(Role.USER), NOW).split("\\.");
        String adminPayload = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                ("{\"sub\":\"5\",\"email\":\"ann@example.com\",\"role\":\"ADMIN\",\"exp\":"
                        + NOW.plusSeconds(600).getEpochSecond() + "}").getBytes());

        assertThat(verifier.verify(parts[0] + "." + adminPayload + "." + parts[2], NOW)).isEmpty();
    }

    @Test
    void rejectsAlgNone() {
        String unsigned = new PlainJWT(claims(NOW.plusSeconds(600))).serialize();

        assertThat(verifier.verify(unsigned, NOW)).isEmpty();
    }

    @Test
    void rejectsHs256SignedWithThePublicKeyAsSecret_theClassicAlgorithmConfusionAttack() throws Exception {
        SignedJWT forged = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims(NOW.plusSeconds(600)));
        forged.sign(new MACSigner(keys.publicKey().getEncoded()));

        assertThat(verifier.verify(forged.serialize(), NOW)).isEmpty();
    }

    @Test
    void rejectsGarbageAndMissingClaimsWithoutThrowing() throws Exception {
        assertThat(verifier.verify("not-a-jwt", NOW)).isEmpty();
        assertThat(verifier.verify("", NOW)).isEmpty();

        SignedJWT noRole = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), new JWTClaimsSet.Builder()
                .subject("5").claim("email", "a@b.c").expirationTime(Date.from(NOW.plusSeconds(600))).build());
        noRole.sign(new com.nimbusds.jose.crypto.RSASSASigner(keys.privateKey()));
        Optional<AuthenticatedUser> result = verifier.verify(noRole.serialize(), NOW);
        assertThat(result).isEmpty();
    }

    private static JWTClaimsSet claims(Instant expiry) {
        return new JWTClaimsSet.Builder().subject("5").claim("email", "ann@example.com").claim("role", "ADMIN")
                .expirationTime(Date.from(expiry)).build();
    }

    private static UserResponse user(Role role) {
        return new UserResponse(5L, "Ann", "ann@example.com", role, true, "UTC", NOW);
    }

    private static JwtKeys newKeys() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair pair = generator.generateKeyPair();
        return new JwtKeys((RSAPublicKey) pair.getPublic(), (RSAPrivateKey) pair.getPrivate());
    }
}
