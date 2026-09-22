package com.ay.revisor.support;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Base for repository tests that need real Postgres — ARCHITECTURE.md §10 calls this out
 * specifically: index and cascade behavior H2's PostgreSQL-compatibility mode doesn't fully
 * replicate. Every subclass shares one container (started once per JVM, per Testcontainers'
 * usual singleton pattern) and points Flyway/Hibernate at it via {@code dev}'s migration set.
 * <p>
 * Requires a Docker daemon reachable from the test JVM; skip with {@code -DexcludeTags=postgres}
 * where Docker isn't available (see build.gradle).
 */
@Tag("postgres")
@Testcontainers
@SpringBootTest(properties = {
        "spring.flyway.locations=classpath:db/migration/postgresql",
        "spring.jpa.hibernate.ddl-auto=validate"
})
public abstract class PostgresIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("revisor_test");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
