package com.ay.revisor.notification;

/**
 * Where a notification can go. A channel skips a recipient it has no address for.
 *
 * @param phone unused in v1 — there is no phone number on {@code User} yet
 */
public record Recipient(String name, String email, String phone) {

    @Override
    public String toString() { // keep addresses out of any log line that prints a recipient
        return "Recipient[name=" + name + "]";
    }
}
