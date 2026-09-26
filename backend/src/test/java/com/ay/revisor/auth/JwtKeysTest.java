package com.ay.revisor.auth;

import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtKeysTest {

    @Test
    void acceptsAMatching2048BitPair() throws Exception {
        KeyPair pair = pair(2048);

        assertThatCode(() -> new JwtKeys((RSAPublicKey) pair.getPublic(), (RSAPrivateKey) pair.getPrivate()))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsKeysShorterThan2048Bits() throws Exception {
        KeyPair pair = pair(1024);

        assertThatThrownBy(() -> new JwtKeys((RSAPublicKey) pair.getPublic(), (RSAPrivateKey) pair.getPrivate()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("1024 bits");
    }

    @Test
    void rejectsAPublicKeyFromADifferentPair() throws Exception {
        KeyPair one = pair(2048);
        KeyPair other = pair(2048);

        assertThatThrownBy(() -> new JwtKeys((RSAPublicKey) other.getPublic(), (RSAPrivateKey) one.getPrivate()))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("does not match");
    }

    private static KeyPair pair(int bits) throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(bits);
        return generator.generateKeyPair();
    }
}
