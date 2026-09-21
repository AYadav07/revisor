package com.ay.revisor.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PemKeysTest {

    @TempDir
    Path dir;

    @Test
    void readsPkcs8PrivateAndX509PublicPemFiles() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair pair = generator.generateKeyPair();
        Path privateFile = write("private.pem", "PRIVATE KEY", pair.getPrivate().getEncoded());
        Path publicFile = write("public.pem", "PUBLIC KEY", pair.getPublic().getEncoded());

        assertThat(PemKeys.readPrivateKey(privateFile).getEncoded()).isEqualTo(pair.getPrivate().getEncoded());
        assertThat(PemKeys.readPublicKey(publicFile).getEncoded()).isEqualTo(pair.getPublic().getEncoded());
    }

    @Test
    void pointsAtTheOpensslConversionWhenGivenAPkcs1Key() throws Exception {
        Path pkcs1 = Files.writeString(dir.resolve("old.pem"),
                "-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----\n");

        assertThatThrownBy(() -> PemKeys.readPrivateKey(pkcs1))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("PKCS#1").hasMessageContaining("pkcs8");
    }

    @Test
    void failsClearlyOnMissingOrMalformedFiles() throws Exception {
        Path junk = Files.writeString(dir.resolve("junk.pem"), "not a key");

        assertThatThrownBy(() -> PemKeys.readPublicKey(junk)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> PemKeys.readPublicKey(dir.resolve("missing.pem")))
                .isInstanceOf(java.io.UncheckedIOException.class);
    }

    private Path write(String name, String label, byte[] der) throws Exception {
        String pem = "-----BEGIN " + label + "-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(der)
                + "\n-----END " + label + "-----\n";
        return Files.writeString(dir.resolve(name), pem);
    }
}
