package com.ay.revisor.notification;

import com.ay.revisor.notification.render.RenderedEmail;
import com.ay.revisor.notification.render.TemplateRenderer;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TemplateRendererTest {

    private final TemplateRenderer renderer = new TemplateRenderer();

    @Test
    void everyTypeHasASubjectAPlainTextBodyAndAnHtmlBody_withTheLinkInBoth() {
        for (NotificationType type : NotificationType.values()) {
            RenderedEmail email = renderer.renderEmail(type, data("Ann"));

            assertThat(email.subject()).isNotBlank().doesNotContain("{{").doesNotContain("\n");
            assertThat(email.text()).contains("Hi Ann", "https://revisor.aydev.in/x?token=abc", "30 minutes")
                    .doesNotContain("{{");
            assertThat(email.html()).contains("href=\"https://revisor.aydev.in/x?token=abc\"", "30 minutes")
                    .doesNotContain("{{");
        }
    }

    @Test
    void valuesAreHtmlEscapedInTheHtmlBody_butNotInThePlainText() {
        RenderedEmail email = renderer.renderEmail(NotificationType.VERIFY_EMAIL, data("<b>Ann</b>"));

        assertThat(email.html()).contains("&lt;b&gt;Ann&lt;/b&gt;").doesNotContain("<b>Ann</b>");
        assertThat(email.text()).contains("<b>Ann</b>");
    }

    @Test
    void aMissingValueFailsLoudly_ratherThanSendingABrokenEmail() {
        assertThatThrownBy(() -> renderer.renderEmail(NotificationType.PASSWORD_RESET, Map.of("name", "Ann")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("link");
    }

    private static Map<String, String> data(String name) {
        return Map.of("name", name, "link", "https://revisor.aydev.in/x?token=abc", "expiresIn", "30 minutes");
    }
}
