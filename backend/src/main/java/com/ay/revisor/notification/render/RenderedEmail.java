package com.ay.revisor.notification.render;

/** An email ready to send: every HTML email also carries a plain-text version (UI_DESIGN.md §6). */
public record RenderedEmail(String subject, String text, String html) {
}
