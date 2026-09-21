package com.ay.revisor.auth;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** The value must be an IANA region id such as {@code Asia/Kolkata} or {@code UTC}. */
@Documented
@Constraint(validatedBy = ValidTimezoneValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidTimezone {

    String message() default "must be a valid IANA timezone id";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
