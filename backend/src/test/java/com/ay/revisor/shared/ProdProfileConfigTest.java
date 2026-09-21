package com.ay.revisor.shared;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The prod profile can't be booted in CI (it needs a real Postgres and key files), so this pins the
 * settings that make it safe: they are easy to drop in an edit and nothing else would notice.
 */
class ProdProfileConfigTest {

    private static Properties prod;

    @BeforeAll
    static void load() {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application-prod.yaml"));
        prod = yaml.getObject();
    }

    @Test
    void swaggerAndTheOpenApiDocumentAreOff() {
        assertThat(prod).containsEntry("springdoc.api-docs.enabled", false).containsEntry("springdoc.swagger-ui.enabled", false);
    }

    @Test
    void cookiesAreSecure_logsAreStructuredJson_andClientIpsComeFromTheProxy() {
        assertThat(prod).containsEntry("app.cookies.secure", true)
                .containsEntry("logging.structured.format.console", "ecs")
                .containsEntry("server.forward-headers-strategy", "native");
    }

    @Test
    void everythingEnvironmentSpecificIsInjectedNotCommitted() {
        assertThat(prod.getProperty("spring.datasource.url")).startsWith("${");
        assertThat(prod.getProperty("spring.datasource.password")).startsWith("${");
        assertThat(prod.getProperty("app.jwt.private-key-path")).startsWith("${");
        assertThat(prod.getProperty("app.cors.allowed-origins")).startsWith("${");
        assertThat(prod).doesNotContainKey("app.jwt.generate-ephemeral-keys");
    }
}
