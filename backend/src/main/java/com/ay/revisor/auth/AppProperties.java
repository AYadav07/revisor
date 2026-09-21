package com.ay.revisor.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.List;

/**
 * Environment-specific security settings (SECURITY.md). Secrets stay in files/env vars and are
 * never committed; only their paths are configured here.
 *
 * @param jwt     RS256 signing key pair. {@code generateEphemeralKeys} is for the {@code local}
 *                profile only — tokens die on restart.
 * @param cookies {@code secure} defaults to true (production); {@code local}/{@code dev} turn it
 *                off because they run over plain HTTP, where a Secure cookie is never sent.
 * @param cors    exact origins allowed to make credentialed requests — never a wildcard.
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(@DefaultValue Jwt jwt, @DefaultValue Cookies cookies, @DefaultValue Cors cors) {

    public record Jwt(String privateKeyPath, String publicKeyPath,
                      @DefaultValue("false") boolean generateEphemeralKeys) {
    }

    public record Cookies(@DefaultValue("true") boolean secure) {
    }

    public record Cors(@DefaultValue List<String> allowedOrigins) {
    }
}
