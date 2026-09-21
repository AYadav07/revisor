package com.ay.revisor.auth;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Reads RSA keys from PEM files: private keys as PKCS#8 ({@code BEGIN PRIVATE KEY}), public
 * keys as X.509 SubjectPublicKeyInfo ({@code BEGIN PUBLIC KEY}). Generate a matching pair with
 * {@code openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private.pem} and
 * {@code openssl pkey -in jwt_private.pem -pubout -out jwt_public.pem}.
 */
final class PemKeys {

    private PemKeys() {
    }

    static RSAPrivateKey readPrivateKey(Path file) {
        String pem = read(file);
        if (pem.contains("BEGIN RSA PRIVATE KEY")) {
            throw new IllegalStateException(file + " is a PKCS#1 key; convert it to PKCS#8 with "
                    + "`openssl pkcs8 -topk8 -nocrypt -in <file>`");
        }
        try {
            return (RSAPrivateKey) KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(decode(pem)));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Cannot parse RSA private key (PKCS#8 PEM) from " + file, e);
        }
    }

    static RSAPublicKey readPublicKey(Path file) {
        try {
            return (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(decode(read(file))));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Cannot parse RSA public key (X.509 PEM) from " + file, e);
        }
    }

    private static String read(Path file) {
        try {
            return Files.readString(file);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read key file " + file, e);
        }
    }

    private static byte[] decode(String pem) {
        String base64 = pem.replaceAll("-----(BEGIN|END) [A-Z ]+-----", "").replaceAll("\\s", "");
        return Base64.getDecoder().decode(base64);
    }
}
