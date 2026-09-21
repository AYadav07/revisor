package com.ay.revisor.shared;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
class ClockConfig {

    /** Controllers take "now" from here and pass it into services, which stay pure functions of it. */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
