package com.ay.revisor.auth;

import com.ay.revisor.shared.AuthenticatedUser;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.stereotype.Component;

import java.text.ParseException;
import java.time.Instant;
import java.util.Optional;

/**
 * Verifies access tokens with the public key only. Anything that is not a well-formed,
 * unexpired RS256 token signed by our key yields empty — never an exception, and never a
 * hint about why. The algorithm is pinned to RS256, so {@code alg: none} and HS256-with-the-
 * public-key-as-secret forgeries are rejected.
 */
@Component
public class AccessTokenVerifier {

    private final RSASSAVerifier verifier;

    AccessTokenVerifier(JwtKeys keys) {
        this.verifier = new RSASSAVerifier(keys.publicKey());
    }

    public Optional<AuthenticatedUser> verify(String token, Instant now) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!JWSAlgorithm.RS256.equals(jwt.getHeader().getAlgorithm()) || !jwt.verify(verifier)) {
                return Optional.empty();
            }
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            if (claims.getExpirationTime() == null || !claims.getExpirationTime().toInstant().isAfter(now)) {
                return Optional.empty();
            }
            String role = claims.getStringClaim("role");
            String email = claims.getStringClaim("email");
            if (claims.getSubject() == null || role == null || email == null) {
                return Optional.empty();
            }
            return Optional.of(new AuthenticatedUser(Long.valueOf(claims.getSubject()), email, role));
        } catch (ParseException | JOSEException | NumberFormatException e) {
            return Optional.empty();
        }
    }
}
