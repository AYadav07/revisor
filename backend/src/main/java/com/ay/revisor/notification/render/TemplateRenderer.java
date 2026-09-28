package com.ay.revisor.notification.render;

import com.ay.revisor.notification.NotificationType;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns a notification type plus its data into message text, from templates kept in the repo under
 * {@code templates/<channel>/} — never provider-hosted templates, so the provider stays swappable.
 * <p>
 * Templates use {@code {{name}}} placeholders and nothing else: these are short transactional
 * messages, so a template engine would be a dependency without a job. Values are HTML-escaped in
 * HTML templates. A placeholder with no value fails loudly rather than sending a broken email.
 */
@Component
public class TemplateRenderer {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*(\\w+)\\s*}}");

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    public RenderedEmail renderEmail(NotificationType type, Map<String, String> data) {
        String base = "templates/email/" + type.templateName();
        return new RenderedEmail(
                fill(load(base + ".subject.txt"), data, UnaryOperator.identity()).strip(),
                fill(load(base + ".txt"), data, UnaryOperator.identity()),
                fill(load(base + ".html"), data, HtmlUtils::htmlEscape));
    }

    private static String fill(String template, Map<String, String> data, UnaryOperator<String> escape) {
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1);
            String value = data.get(key);
            if (value == null) {
                throw new IllegalStateException("No value for template placeholder '" + key + "'");
            }
            matcher.appendReplacement(out, Matcher.quoteReplacement(escape.apply(value)));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private String load(String path) {
        return cache.computeIfAbsent(path, p -> {
            try (InputStream in = new ClassPathResource(p).getInputStream()) {
                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException("Missing email template " + p, e);
            }
        });
    }
}
