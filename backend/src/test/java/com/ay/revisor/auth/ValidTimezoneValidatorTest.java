package com.ay.revisor.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ValidTimezoneValidatorTest {

    private final ValidTimezoneValidator validator = new ValidTimezoneValidator();

    @ParameterizedTest
    @ValueSource(strings = {"Asia/Kolkata", "America/New_York", "UTC", "Europe/London"})
    void acceptsIanaRegionIds(String zone) {
        assertThat(validator.isValid(zone, null)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Mars/Olympus", "", " ", "+05:30", "kolkata"})
    void rejectsEverythingElse(String zone) {
        assertThat(validator.isValid(zone, null)).isFalse();
    }

    @Test
    void nullPassesSoNotBlankOwnsTheMissingValueMessage() {
        assertThat(validator.isValid(null, null)).isTrue();
    }
}
