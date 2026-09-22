package com.ay.revisor.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration
public class TestClockConfig {

    /** Replaces the production Clock everywhere — the JWT filter, controllers and token issuing all agree on "now". */
    @Bean
    @Primary
    TestClock testClock() {
        return new TestClock();
    }
}
