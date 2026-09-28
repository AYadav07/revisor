package com.ay.revisor.notification.channel;

import com.ay.revisor.notification.Channel;
import com.ay.revisor.notification.Notification;
import com.ay.revisor.notification.NotificationChannel;
import com.ay.revisor.notification.render.RenderedEmail;
import com.ay.revisor.notification.render.TemplateRenderer;
import com.ay.revisor.notification.transport.email.EmailMessage;
import com.ay.revisor.notification.transport.email.EmailSender;
import org.springframework.stereotype.Component;

/** Renders with the email templates, delivers through whichever {@link EmailSender} is configured. */
@Component
public class EmailChannel implements NotificationChannel {

    private final TemplateRenderer renderer;
    private final EmailSender sender;

    public EmailChannel(TemplateRenderer renderer, EmailSender sender) {
        this.renderer = renderer;
        this.sender = sender;
    }

    @Override
    public Channel channel() {
        return Channel.EMAIL;
    }

    @Override
    public void send(Notification notification) {
        String address = notification.to().email();
        if (address == null || address.isBlank()) {
            return;
        }
        RenderedEmail email = renderer.renderEmail(notification.type(), notification.data());
        sender.send(new EmailMessage(address, email.subject(), email.text(), email.html()));
    }
}
