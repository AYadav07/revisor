package com.ay.revisor.auth;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Full-context tests over the real security chain, H2 and services — the auth flow as a browser sees it. */
@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    private static final String SIGNUP = """
            {"name":"Ann","email":"ann@example.com","password":"correct-horse","timezone":"Asia/Kolkata"}""";
    private static final String LOGIN = """
            {"email":"ann@example.com","password":"correct-horse"}""";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @AfterEach
    void cleanUp() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void signup_returns201WithUserShapeAndNoPasswordHash() throws Exception {
        mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(SIGNUP))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("ann@example.com"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void signup_duplicateEmail_is409ProblemDetail() throws Exception {
        signup();

        mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(SIGNUP))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://revisor.dev/errors/conflict"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.instance").value("/api/v1/auth/signup"));
    }

    @Test
    void signup_invalidBody_is400WithPerFieldErrors() throws Exception {
        mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"","email":"nope","password":"short","timezone":"Mars/X"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("https://revisor.dev/errors/validation-failed"))
                .andExpect(jsonPath("$.errors[?(@.field=='timezone')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field=='password')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field=='email')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field=='name')]").exists());
    }

    @Test
    void login_setsHttpOnlySameSiteStrictCookiesWithTheDocumentedPaths() throws Exception {
        signup();

        MvcResult result = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("ann@example.com"))
                .andExpect(jsonPath("$.user.role").value("USER"))
                .andReturn();

        List<String> cookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        String access = cookieHeader(cookies, "accessToken");
        String refresh = cookieHeader(cookies, "refreshToken");
        assertThat(access).contains("HttpOnly", "SameSite=Strict", "Path=/;", "Max-Age=900");
        assertThat(refresh).contains("HttpOnly", "SameSite=Strict", "Path=/api/v1/auth", "Max-Age=1209600");
        // Local profile: Secure is off because local dev is plain HTTP. Production default is on.
        assertThat(access).doesNotContain("Secure");
    }

    @Test
    void login_wrongPassword_and_unknownEmail_areIdentical401s() throws Exception {
        signup();

        String wrongPassword = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"ann@example.com","password":"wrong-password"}"""))
                .andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();
        String unknownEmail = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"nobody@example.com","password":"wrong-password"}"""))
                .andExpect(status().isUnauthorized()).andReturn().getResponse().getContentAsString();

        assertThat(wrongPassword.replace("ann@", "")).isEqualTo(unknownEmail);
    }

    @Test
    void accessCookieAuthenticatesProtectedEndpoints_andItsAbsenceIs401ProblemDetail() throws Exception {
        signup();
        Cookie access = login().accessCookie;

        // No controller owns this path yet: 404 proves the request got PAST security; 401 would mean it didn't.
        mvc.perform(get("/api/v1/does-not-exist").cookie(access)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/does-not-exist"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentType("application/problem+json;charset=UTF-8"))
                .andExpect(jsonPath("$.type").value("https://revisor.dev/errors/unauthorized"))
                .andExpect(jsonPath("$.instance").value("/api/v1/does-not-exist"));
        mvc.perform(get("/api/v1/does-not-exist").cookie(new Cookie("accessToken", "forged.token.value")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_rotatesTheTokenAndIssuesNewCookies() throws Exception {
        signup();
        Session first = login();

        MvcResult refreshed = mvc.perform(post("/api/v1/auth/refresh").cookie(first.refreshCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("ann@example.com"))
                .andReturn();

        List<String> cookies = refreshed.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        assertThat(cookieHeader(cookies, "accessToken")).isNotBlank();
        assertThat(cookieValue(cookies, "refreshToken")).isNotEqualTo(first.refreshCookie.getValue());
    }

    @Test
    void replayingARotatedRefreshCookie_is401_andKillsTheLegitimateSessionToo() throws Exception {
        signup();
        Session first = login();
        MvcResult refreshed = mvc.perform(post("/api/v1/auth/refresh").cookie(first.refreshCookie))
                .andExpect(status().isOk()).andReturn();
        Cookie current = new Cookie("refreshToken",
                cookieValue(refreshed.getResponse().getHeaders(HttpHeaders.SET_COOKIE), "refreshToken"));

        mvc.perform(post("/api/v1/auth/refresh").cookie(first.refreshCookie)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").cookie(current)).andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_withoutACookie_is401NotAServerError() throws Exception {
        mvc.perform(post("/api/v1/auth/refresh")).andExpect(status().isUnauthorized());
    }

    @Test
    void logout_revokesTheSessionServerSide_andClearsBothCookies() throws Exception {
        signup();
        Session session = login();

        MvcResult result = mvc.perform(post("/api/v1/auth/logout").cookie(session.refreshCookie))
                .andExpect(status().isNoContent()).andReturn();

        List<String> cookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        assertThat(cookieHeader(cookies, "accessToken")).contains("Max-Age=0");
        assertThat(cookieHeader(cookies, "refreshToken")).contains("Max-Age=0", "Path=/api/v1/auth");
        mvc.perform(post("/api/v1/auth/refresh").cookie(session.refreshCookie)).andExpect(status().isUnauthorized());
    }

    @Test
    void logout_worksEvenWithNoSession() throws Exception {
        mvc.perform(post("/api/v1/auth/logout")).andExpect(status().isNoContent());
    }

    @Test
    void cors_allowsCredentialedRequestsFromTheConfiguredFrontendOriginOnly() throws Exception {
        mvc.perform(options("/api/v1/auth/login")
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
        mvc.perform(options("/api/v1/auth/login")
                        .header(HttpHeaders.ORIGIN, "http://evil.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isForbidden());
    }

    private void signup() throws Exception {
        mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(SIGNUP))
                .andExpect(status().isCreated());
    }

    private Session login() throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN))
                .andExpect(status().isOk()).andReturn();
        List<String> cookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        return new Session(new Cookie("accessToken", cookieValue(cookies, "accessToken")),
                new Cookie("refreshToken", cookieValue(cookies, "refreshToken")));
    }

    private record Session(Cookie accessCookie, Cookie refreshCookie) {
    }

    private static String cookieHeader(List<String> setCookies, String name) {
        return setCookies.stream().filter(c -> c.startsWith(name + "=")).findFirst().orElseThrow();
    }

    private static String cookieValue(List<String> setCookies, String name) {
        String header = cookieHeader(setCookies, name);
        return header.substring(name.length() + 1, header.indexOf(';'));
    }
}
