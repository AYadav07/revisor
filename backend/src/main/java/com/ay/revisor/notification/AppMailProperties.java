package com.ay.revisor.notification;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * App-level email settings. The SMTP connection itself is Spring Boot's {@code spring.mail.*}
 * (host, port, credentials), so switching provider never touches code (DEPLOYMENT.md).
 *
 * @param from        sender, e.g. {@code Revisor <noreply@aydev.in>}
 * @param frontendUrl base of the links in emails, e.g. {@code https://revisor.aydev.in} — links always
 *                    point at the frontend, never at the API (SECURITY.md)
 * @param transport   {@code smtp} (default), or {@code log} to write a one-line note instead of sending,
 *                    for the in-memory {@code local} profile
 */
@Validated
@ConfigurationProperties(prefix = "app.mail")
public record AppMailProperties(@NotBlank String from, @NotBlank String frontendUrl,
                             @DefaultValue("smtp") String transport) {
}
