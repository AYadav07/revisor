package com.ay.revisor.auth;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Auth events are logged by user id, and nothing sensitive leaks into the log (SECURITY.md, "Logging
 * discipline"). Same context configuration as {@link AuthControllerTest}, so the context is shared.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class AuthLoggingTest {

    private static final String EMAIL = "ann@example.com";
    private static final String PASSWORD = "correct-horse";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    @Autowired
    private AuthRateLimiter rateLimiter;

    @AfterEach
    void cleanUp() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
        rateLimiter.clear();
    }

    @Test
    void signupAndLogins_areLoggedByUserId_neverByEmailPasswordOrToken(CapturedOutput output) throws Exception {
        signup();
        Long id = userRepository.findByEmail(EMAIL).orElseThrow().getId();
        Cookie refresh = login(PASSWORD).getCookie(AuthCookies.REFRESH);
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(loginBody("wrong-password"))).andExpect(status().isUnauthorized());

        assertThat(output.getOut())
                .contains("User " + id + " signed up")
                .contains("User " + id + " logged in")
                .contains("Login failed for user " + id + ": wrong password")
                .doesNotContain(EMAIL)
                .doesNotContain(PASSWORD)
                .doesNotContain("wrong-password")
                .doesNotContain(refresh.getValue())
                .doesNotContain(OpaqueTokens.hash(refresh.getValue()));
    }

    @Test
    void loginWithUnknownEmail_isLoggedWithoutTheEmail(CapturedOutput output) throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"nobody@example.com\",\"password\":\"whatever-1\"}")).andExpect(status().isUnauthorized());

        assertThat(output.getOut()).contains("Login failed: unknown email").doesNotContain("nobody@example.com");
    }

    @Test
    void refreshTokenReuse_isAWarning(CapturedOutput output) throws Exception {
        signup();
        Long id = userRepository.findByEmail(EMAIL).orElseThrow().getId();
        Cookie first = login(PASSWORD).getCookie(AuthCookies.REFRESH);
        mvc.perform(post("/api/v1/auth/refresh").cookie(first)).andExpect(status().isOk());

        mvc.perform(post("/api/v1/auth/refresh").cookie(first)).andExpect(status().isUnauthorized());

        assertThat(output.getOut()).containsPattern("WARN.*Refresh token reuse for user " + id + ": revoking token family");
    }

    @Test
    void hittingTheLoginRateLimit_isAWarning_withoutTheEmail(CapturedOutput output) throws Exception {
        for (int i = 0; i < AuthRateLimiter.LOGIN_ATTEMPTS + 1; i++) {
            mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody("wrong-password")));
        }

        assertThat(output.getOut()).containsPattern("WARN.*Login rate limit hit").doesNotContain(EMAIL);
    }

    private void signup() throws Exception {
        mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(
                "{\"name\":\"Ann\",\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD + "\",\"timezone\":\"UTC\"}"))
                .andExpect(status().isCreated());
    }

    private MockHttpServletResponse login(String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(password)))
                .andExpect(status().isOk()).andReturn().getResponse();
    }

    private static String loginBody(String password) {
        return "{\"email\":\"" + EMAIL + "\",\"password\":\"" + password + "\"}";
    }
}
