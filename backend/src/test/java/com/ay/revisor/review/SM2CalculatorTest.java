package com.ay.revisor.review;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SM2CalculatorTest {

    @Test
    void initialState_matchesArchitectureDefaults() {
        SM2Calculator.Sm2State initial = SM2Calculator.initialState();

        assertThat(initial.easeFactor()).isEqualByComparingTo("2.50");
        assertThat(initial.intervalDays()).isEqualTo(1);
        assertThat(initial.repetitionCount()).isEqualTo(0);
    }

    @Test
    void firstSuccessfulReview_setsIntervalToOneDayAndIncrementsRepetitions() {
        SM2Calculator.Sm2State next = SM2Calculator.next(4, SM2Calculator.initialState());

        assertThat(next.intervalDays()).isEqualTo(1);
        assertThat(next.repetitionCount()).isEqualTo(1);
    }

    @Test
    void secondSuccessfulReview_setsIntervalToSixDays() {
        SM2Calculator.Sm2State afterFirst = SM2Calculator.next(4, SM2Calculator.initialState());

        SM2Calculator.Sm2State afterSecond = SM2Calculator.next(4, afterFirst);

        assertThat(afterSecond.intervalDays()).isEqualTo(6);
        assertThat(afterSecond.repetitionCount()).isEqualTo(2);
    }

    @Test
    void thirdSuccessfulReview_multipliesPreviousIntervalByEaseFactor() {
        SM2Calculator.Sm2State state = SM2Calculator.next(4, SM2Calculator.initialState());
        state = SM2Calculator.next(4, state);

        SM2Calculator.Sm2State afterThird = SM2Calculator.next(4, state);

        int expectedInterval = (int) Math.round(state.intervalDays() * state.easeFactor().doubleValue());
        assertThat(afterThird.intervalDays()).isEqualTo(expectedInterval);
        assertThat(afterThird.repetitionCount()).isEqualTo(3);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2})
    void lowQuality_resetsRepetitionsAndIntervalButLeavesEaseFactorUnchanged(int quality) {
        SM2Calculator.Sm2State established = SM2Calculator.next(4, SM2Calculator.next(4, SM2Calculator.initialState()));

        SM2Calculator.Sm2State reset = SM2Calculator.next(quality, established);

        assertThat(reset.repetitionCount()).isEqualTo(0);
        assertThat(reset.intervalDays()).isEqualTo(1);
        assertThat(reset.easeFactor()).isEqualByComparingTo(established.easeFactor());
    }

    @Test
    void easeFactor_neverDropsBelowMinimumOfOnePointThree() {
        SM2Calculator.Sm2State state = new SM2Calculator.Sm2State(BigDecimal.valueOf(1.30), 30, 5);

        SM2Calculator.Sm2State next = SM2Calculator.next(3, state);

        assertThat(next.easeFactor()).isEqualByComparingTo("1.30");
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 6})
    void quality_outsideZeroToFiveRange_throws(int invalidQuality) {
        assertThatThrownBy(() -> SM2Calculator.next(invalidQuality, SM2Calculator.initialState()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
