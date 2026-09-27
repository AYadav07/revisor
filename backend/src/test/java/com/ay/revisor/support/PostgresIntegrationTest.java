package com.ay.revisor.support;

import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base for repository tests that need real Postgres — ARCHITECTURE.md §10 calls this out
 * specifically: index and cascade behavior H2's PostgreSQL-compatibility mode doesn't fully
 * replicate. Points Flyway/Hibernate at the PostgreSQL migration set, overriding the H2 settings of
 * the {@code local} profile every test runs under (see build.gradle).
 * <p>
 * Every subclass shares one container, started once per JVM and removed by Testcontainers' Ryuk
 * sidecar when the JVM exits. Deliberately not a JUnit-managed {@code @Container}: that stops the
 * container after each test class while Spring's cached context still points at it, so every later
 * class hangs waiting for connections to a dead database.
 * <p>
 * Tagged {@code postgres}: excluded from {@code ./gradlew test} unless {@code -PincludePostgresTests}
 * is passed, since it needs a reachable Docker daemon.
 */
@Tag("postgres")
@SpringBootTest(properties = {
        "spring.flyway.locations=classpath:db/migration/postgresql",
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.jpa.hibernate.ddl-auto=validate"
})
public abstract class PostgresIntegrationTest {

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("revisor_test");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
