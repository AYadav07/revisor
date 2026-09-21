package com.ay.revisor.shared;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Metadata for the springdoc-generated OpenAPI document (SECURITY.md: served in local/dev, turned
 * off in production). The spec itself is derived from the controllers, so it cannot drift from the API.
 */
@Configuration
class OpenApiConfig {

    private static final String COOKIE_AUTH = "accessTokenCookie";

    @Bean
    OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Revisor API")
                        .version("v1")
                        .description("Personal interview-prep app: courses, topics and subtopics with SM-2 spaced "
                                + "repetition. Errors are RFC 7807 Problem Details. Authenticate via POST "
                                + "/api/v1/auth/login, which sets httpOnly cookies."))
                .components(new Components().addSecuritySchemes(COOKIE_AUTH, new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.COOKIE)
                        .name("accessToken")
                        .description("RS256 access-token cookie set by /auth/login and /auth/refresh")))
                .addSecurityItem(new SecurityRequirement().addList(COOKIE_AUTH));
    }
}
