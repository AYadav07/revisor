package com.ay.revisor.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration
public class EmailTestConfig {

    /** Replaces the local profile's log-only transport, so tests can read what would have been sent. */
    @Bean
    @Primary
    RecordingEmailSender recordingEmailSender() {
        return new RecordingEmailSender();
    }
}
