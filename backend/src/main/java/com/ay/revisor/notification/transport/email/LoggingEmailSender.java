package com.ay.revisor.notification.transport.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * {@code app.mail.transport=log}: sends nothing, just notes that an email would have gone out. For the
 * in-memory {@code local} profile, which has no SMTP server. Logs the subject only — never the address
 * or the body, which holds the token link. To click real links locally, use the {@code dev} profile
 * with Mailpit.
 */
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "transport", havingValue = "log")
public class LoggingEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingEmailSender.class);

    @Override
    public void send(EmailMessage message) {
        log.info("Email \"{}\" not sent: app.mail.transport=log", message.subject());
    }
}
