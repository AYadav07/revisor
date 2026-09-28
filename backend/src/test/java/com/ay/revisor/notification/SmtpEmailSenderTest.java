package com.ay.revisor.notification;

import com.ay.revisor.notification.transport.email.EmailMessage;
import com.ay.revisor.notification.transport.email.SmtpEmailSender;
import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetupTest;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The real SMTP transport against an in-process SMTP server (GreenMail) — never a real provider. */
class SmtpEmailSenderTest {

    private GreenMail smtp;

    @BeforeEach
    void startSmtp() {
        smtp = new GreenMail(ServerSetupTest.SMTP);
        smtp.start();
    }

    @AfterEach
    void stopSmtp() {
        smtp.stop();
    }

    @Test
    void sendsAMultipartEmail_withTheConfiguredSender_andBothBodies() throws Exception {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost("127.0.0.1");
        mailSender.setPort(ServerSetupTest.SMTP.getPort());
        SmtpEmailSender sender = new SmtpEmailSender(mailSender,
                new AppMailProperties("Revisor <noreply@aydev.in>", "https://revisor.aydev.in", "smtp"));

        sender.send(new EmailMessage("ann@example.com", "Verify your email for Revisor",
                "Plain link: https://revisor.aydev.in/verify-email?token=abc",
                "<p><a href=\"https://revisor.aydev.in/verify-email?token=abc\">Verify</a></p>"));

        assertThat(smtp.waitForIncomingEmail(5_000, 1)).isTrue();
        MimeMessage received = smtp.getReceivedMessages()[0];
        assertThat(received.getSubject()).isEqualTo("Verify your email for Revisor");
        InternetAddress from = (InternetAddress) received.getFrom()[0];
        assertThat(from.getAddress()).isEqualTo("noreply@aydev.in");
        assertThat(from.getPersonal()).isEqualTo("Revisor");
        assertThat(received.getAllRecipients()[0].toString()).isEqualTo("ann@example.com");
        List<String> types = new ArrayList<>();
        List<String> bodies = new ArrayList<>();
        collectParts(received, types, bodies);
        assertThat(types).anyMatch(t -> t.startsWith("text/plain")).anyMatch(t -> t.startsWith("text/html"));
        assertThat(bodies).hasSize(2).allMatch(body -> body.contains("verify-email?token=abc"));
    }

    /** Decoded text of every leaf part, whatever transfer encoding JavaMail chose. */
    private static void collectParts(Part part, List<String> types, List<String> bodies) throws Exception {
        Object content = part.getContent();
        if (content instanceof Multipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                collectParts(multipart.getBodyPart(i), types, bodies);
            }
        } else if (content instanceof String text) {
            types.add(part.getContentType().toLowerCase());
            bodies.add(text);
        }
    }
}
