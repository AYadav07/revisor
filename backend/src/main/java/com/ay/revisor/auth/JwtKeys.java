package com.ay.revisor.auth;

import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Objects;

/**
 * The RS256 signing pair. Checked on construction, so a misconfigured deployment fails at startup
 * rather than issuing tokens nobody can verify: 2048-bit minimum (SECURITY.md), and the two halves
 * must belong together — mismatched files would sign every token with a key the verifier rejects.
 */
public record JwtKeys(RSAPublicKey publicKey, RSAPrivateKey privateKey) {

    static final int MIN_KEY_BITS = 2048;

    public JwtKeys {
        Objects.requireNonNull(publicKey, "publicKey");
        Objects.requireNonNull(privateKey, "privateKey");
        int bits = publicKey.getModulus().bitLength();
        if (bits < MIN_KEY_BITS) {
            throw new IllegalStateException("JWT RSA key is " + bits + " bits; at least " + MIN_KEY_BITS + " are required");
        }
        if (!publicKey.getModulus().equals(privateKey.getModulus())) {
            throw new IllegalStateException("JWT public key does not match the private key: check that "
                    + "JWT_PUBLIC_KEY_PATH was derived from JWT_PRIVATE_KEY_PATH");
        }
    }
}
