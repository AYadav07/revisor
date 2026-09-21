package com.ay.revisor.shared;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** What production does (see application-prod.yaml): the spec and UI are gone and their paths are not left public. */
@SpringBootTest(properties = {"springdoc.api-docs.enabled=false", "springdoc.swagger-ui.enabled=false"})
@AutoConfigureMockMvc
class ApiDocsDisabledTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void theOpenApiDocumentAndSwaggerUiAreNotServed() throws Exception {
        for (String path : new String[]{"/v3/api-docs", "/swagger-ui/index.html", "/swagger-ui.html"}) {
            int code = mvc.perform(get(path)).andReturn().getResponse().getStatus();
            // 401: the paths are no longer permitAll, so anonymous callers get the same answer as for any protected URL.
            assertThat(code).as(path).isEqualTo(401);
        }
    }
}
