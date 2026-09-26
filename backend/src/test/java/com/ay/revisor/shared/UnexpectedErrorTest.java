package com.ay.revisor.shared;

import com.ay.revisor.support.ControllerTestBase;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A bug in a handler: the caller gets a bare Problem Details 500, the log gets the whole story. */
@Import(UnexpectedErrorTest.BoomController.class)
@ExtendWith(OutputCaptureExtension.class)
class UnexpectedErrorTest extends ControllerTestBase {

    /** Nested in a test class, so component scanning skips it; only this test's context has it. */
    @RestController
    static class BoomController {
        @GetMapping("/api/v1/test-only/boom")
        String boom() {
            throw new IllegalStateException("internal detail: secret-table-name");
        }
    }

    @Test
    void unhandledException_is500ProblemDetail_revealingNoInternals() throws Exception {
        TestUser ann = createUser("ann@example.com");

        String body = mvc.perform(get("/api/v1/test-only/boom").cookie(ann.cookie()))
                .andExpect(status().isInternalServerError())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://revisor.dev/errors/internal-error"))
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.instance").value("/api/v1/test-only/boom"))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("secret-table-name").doesNotContain("IllegalStateException");
    }

    @Test
    void unhandledException_isLoggedWithStackTraceAndRequestId(CapturedOutput output) throws Exception {
        TestUser ann = createUser("ann@example.com");

        mvc.perform(get("/api/v1/test-only/boom").cookie(ann.cookie()).header("X-Request-Id", "trace-500"))
                .andExpect(status().isInternalServerError());

        assertThat(output.getOut())
                .contains("[trace-500]")
                .contains("Unhandled exception on uri=/api/v1/test-only/boom")
                .contains("java.lang.IllegalStateException: internal detail: secret-table-name");
    }
}
