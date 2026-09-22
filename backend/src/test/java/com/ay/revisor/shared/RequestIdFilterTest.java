package com.ay.revisor.shared;

import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    void keepsAWellFormedCallerIdEverywhere_MdcDuringTheRequestAndTheResponseHeader() throws Exception {
        MockHttpServletRequest request = requestWithId("client-id_1.2");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> seenInChain = new AtomicReference<>();

        filter.doFilter(request, response, (req, res) -> seenInChain.set(MDC.get("requestId")));

        assertThat(seenInChain.get()).isEqualTo("client-id_1.2");
        assertThat(response.getHeader("X-Request-Id")).isEqualTo("client-id_1.2");
    }

    @Test
    void generatesAUuidWhenNoneIsSent() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest(), response, new MockFilterChain());

        assertThat(response.getHeader("X-Request-Id")).matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }

    /** The id goes into logs and a response header, so anything that could forge a line or inject a header is replaced. */
    @ParameterizedTest
    @ValueSource(strings = {"has space", "semi;colon", "line\nbreak", "carriage\rreturn", "<script>", "", "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"})
    void replacesMalformedOrHostileIds(String hostile) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(requestWithId(hostile), response, new MockFilterChain());

        assertThat(response.getHeader("X-Request-Id")).isNotEqualTo(hostile).hasSize(36);
    }

    @Test
    void clearsTheMdcAfterwards_evenWhenTheChainThrows() {
        assertThatThrownBy(() -> filter.doFilter(requestWithId("abc"), new MockHttpServletResponse(),
                (req, res) -> {
                    throw new ServletException("boom");
                })).isInstanceOf(ServletException.class);

        assertThat(MDC.get("requestId")).isNull();
    }

    @Test
    void doesNotLeakOneRequestsIdIntoTheNext() throws IOException, ServletException {
        filter.doFilter(requestWithId("first"), new MockHttpServletResponse(), new MockFilterChain());
        AtomicReference<String> second = new AtomicReference<>();

        filter.doFilter(requestWithId("second"), new MockHttpServletResponse(), (req, res) -> second.set(MDC.get("requestId")));

        assertThat(second.get()).isEqualTo("second");
    }

    private static MockHttpServletRequest requestWithId(String id) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Request-Id", id);
        return request;
    }
}
