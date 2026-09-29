package com.ay.revisor.notification.transport.email;

import com.ay.revisor.notification.AppMailProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * The only real {@link EmailSender}: plain SMTP through Spring's {@link JavaMailSender}, configured by
 * {@code spring.mail.*}. Every transactional provider speaks SMTP, so SMTP2GO → any other provider is a
 * change of host and credentials, not of code (DEPLOYMENT.md). Mailpit locally, GreenMail in tests.
 */
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "transport", havingValue = "smtp", matchIfMissing = true)
public class SmtpEmailSender implements EmailSender {

    private final JavaMailSender mailSender;
    private final String from;

    public SmtpEmailSender(JavaMailSender mailSender, AppMailProperties properties) {
        this.mailSender = mailSender;
        this.from = properties.from();
    }

    @Override
    public void send(EmailMessage message) {
        MimeMessage mime = mailSender.createMimeMessage();
        try {
            // multipart: a plain-text part plus an HTML alternative
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(message.to());
            helper.setSubject(message.subject());
            helper.setText(message.text(), message.html());
        } catch (MessagingException e) {
            throw new MailPreparationException(e);
        }
        mailSender.send(mime);
    }
}
