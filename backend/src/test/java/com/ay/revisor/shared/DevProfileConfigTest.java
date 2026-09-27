package com.ay.revisor.shared;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/** Only the in-memory local profile may mint throwaway JWT keys (SECURITY.md); dev loads real ones. */
class DevProfileConfigTest {

    @Test
    void devLoadsJwtKeysFromFiles_overridableByEnv_andNeverGeneratesThem() {
        Properties dev = load("application-dev.yaml");

        assertThat(dev.getProperty("app.jwt.private-key-path")).startsWith("${JWT_PRIVATE_KEY_PATH:");
        assertThat(dev.getProperty("app.jwt.public-key-path")).startsWith("${JWT_PUBLIC_KEY_PATH:");
        assertThat(dev).doesNotContainKey("app.jwt.generate-ephemeral-keys");
        assertThat(load("application-local.yaml")).containsEntry("app.jwt.generate-ephemeral-keys", true);
    }

    private static Properties load(String file) {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource(file));
        return yaml.getObject();
    }
}
