package com.ay.revisor.notification.transport.email;

/** One email to one address. The sender address comes from configuration, not from callers. */
public record EmailMessage(String to, String subject, String text, String html) {

    @Override
    public String toString() { // the body holds a token link; the address is personal data
        return "EmailMessage[subject=" + subject + "]";
    }
}
