package com.ay.revisor.dashboard;

import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * API.md spells the values {@code today|week}; Spring's built-in enum binding only matches the
 * exact constant name ({@code TODAY}), so accept either case. Anything else surfaces as a 400.
 */
@Component
class DueRangeConverter implements Converter<String, DueRange> {

    @Override
    public DueRange convert(String source) {
        return DueRange.valueOf(source.trim().toUpperCase(Locale.ROOT));
    }
}
