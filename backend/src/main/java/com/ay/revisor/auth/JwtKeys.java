package com.ay.revisor.auth;

import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;

public record JwtKeys(RSAPublicKey publicKey, RSAPrivateKey privateKey) {
}
