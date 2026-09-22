package com.ay.revisor.shared;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Actuator health, request-id correlation and the generated API docs, as served in the local/dev profiles. */
@SpringBootTest
@AutoConfigureMockMvc
class OperationalEndpointsTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void health_isPublic_reportsUp_andRevealsNoComponentDetails() throws Exception {
        String body = mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("jdbc").doesNotContain("H2").doesNotContain("PostgreSQL");
    }

    @Test
    void livenessAndReadinessProbesArePublic() throws Exception {
        mvc.perform(get("/actuator/health/liveness")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        mvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void everyOtherActuatorEndpoint_isNotExposed() throws Exception {
        for (String endpoint : new String[]{"env", "beans", "metrics", "heapdump", "configprops", "mappings", "loggers"}) {
            int code = mvc.perform(get("/actuator/" + endpoint)).andReturn().getResponse().getStatus();
            assertThat(code).as(endpoint).isIn(401, 404);
        }
    }

    @Test
    void everyResponse_carriesARequestId_theCallersWhenWellFormed() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(header().string("X-Request-Id", org.hamcrest.Matchers.matchesPattern("[0-9a-f-]{36}")));
        mvc.perform(get("/actuator/health").header("X-Request-Id", "trace-42"))
                .andExpect(header().string("X-Request-Id", "trace-42"));
        // Rejected requests are correlated too — the filter runs ahead of Spring Security.
        mvc.perform(get("/api/v1/courses").header("X-Request-Id", "trace-43"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("X-Request-Id", "trace-43"));
    }

    @Test
    void openApiDocument_isServedWithEveryModulesEndpointsAndTheCookieScheme() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("Revisor API"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/login']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/courses']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/courses/{id}']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/subtopics/{id}/review']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/dashboard/summary']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/admin/users']").exists())
                .andExpect(jsonPath("$.components.securitySchemes.accessTokenCookie.in").value("cookie"));
    }

    @Test
    void swaggerUi_isServed() throws Exception {
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
    }
}
