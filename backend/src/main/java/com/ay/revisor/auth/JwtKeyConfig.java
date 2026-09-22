package com.ay.revisor.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;

@Configuration
class JwtKeyConfig {

    /** Fails fast at startup if keys are neither configured nor explicitly allowed to be generated. */
    @Bean
    JwtKeys jwtKeys(AppProperties properties) {
        AppProperties.Jwt jwt = properties.jwt();
        if (jwt.generateEphemeralKeys()) {
            return generate();
        }
        if (!StringUtils.hasText(jwt.privateKeyPath()) || !StringUtils.hasText(jwt.publicKeyPath())) {
            throw new IllegalStateException("JWT keys are not configured: set app.jwt.private-key-path and "
                    + "app.jwt.public-key-path (JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH), or enable "
                    + "app.jwt.generate-ephemeral-keys for local development only");
        }
        return new JwtKeys(PemKeys.readPublicKey(Path.of(jwt.publicKeyPath())),
                PemKeys.readPrivateKey(Path.of(jwt.privateKeyPath())));
    }

    private static JwtKeys generate() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            KeyPair pair = generator.generateKeyPair();
            return new JwtKeys((RSAPublicKey) pair.getPublic(), (RSAPrivateKey) pair.getPrivate());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("RSA is required on every JVM", e);
        }
    }
}
