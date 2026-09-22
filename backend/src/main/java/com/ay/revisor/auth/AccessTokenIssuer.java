package com.ay.revisor.auth;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;

/**
 * Mints RS256 access tokens. The only class that touches the private key (SECURITY.md):
 * everything else verifies with the public key via {@link AccessTokenVerifier}.
 * Claims are kept minimal: {@code sub} (user id), {@code email}, {@code role}, {@code iat}, {@code exp}.
 */
@Component
public class AccessTokenIssuer {

    public static final Duration ACCESS_TOKEN_TTL = Duration.ofMinutes(15);

    private final RSASSASigner signer;

    AccessTokenIssuer(JwtKeys keys) {
        this.signer = new RSASSASigner(keys.privateKey());
    }

    public String issue(UserResponse user, Instant now) {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(String.valueOf(user.id()))
                .claim("email", user.email())
                .claim("role", user.role().name())
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plus(ACCESS_TOKEN_TTL)))
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims);
        try {
            jwt.sign(signer);
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to sign access token", e);
        }
        return jwt.serialize();
    }
}
