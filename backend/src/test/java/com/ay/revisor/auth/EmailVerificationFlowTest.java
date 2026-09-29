package com.ay.revisor.auth;

import com.ay.revisor.notification.transport.email.EmailMessage;
import com.ay.revisor.support.EmailTestConfig;
import com.ay.revisor.support.RecordingEmailSender;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;

import static com.ay.revisor.support.RecordingEmailSender.tokenFrom;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Email verification and password reset end to end, as a user sees them: the link is read out of the
 * actual rendered email (captured instead of sent), then redeemed through the API the frontend calls.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(EmailTestConfig.class)
class EmailVerificationFlowTest {

    private static final String EMAIL = "ann@example.com";
    private static final String PASSWORD = "correct-horse";
    private static final String NEW_PASSWORD = "battery-staple";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private AuthRateLimiter rateLimiter;
    @Autowired
    private RecordingEmailSender emails;

    @BeforeEach
    void clearEmails() {
        emails.clear();
    }

    @AfterEach
    void cleanUp() {
        userRepository.deleteAll(); // cascades to refresh and email tokens
        rateLimiter.clear();
    }

    @Test
    void signup_emailsAVerificationLink_whichUnlocksLogin_andWorksOnlyOnce() throws Exception {
        signup();
        EmailMessage email = emails.awaitMessage(1);
        assertThat(email.to()).isEqualTo(EMAIL);
        assertThat(email.subject()).containsIgnoringCase("verify");
        assertThat(email.text()).contains("Hi Ann", "http://localhost:5173/verify-email?token=", "24 hours");
        assertThat(email.html()).contains("href=\"http://localhost:5173/verify-email?token=");
        String token = tokenFrom(email);

        login(PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value("https://revisor.aydev.in/errors/email-not-verified"));

        postJson("/api/v1/auth/verify-email", tokenBody(token)).andExpect(status().isOk());
        login(PASSWORD).andExpect(status().isOk());

        postJson("/api/v1/auth/verify-email", tokenBody(token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("https://revisor.aydev.in/errors/invalid-token"));
    }

    @Test
    void verifyEmail_withAnUnknownToken_is400InvalidToken_andABlankOneIsAValidationError() throws Exception {
        postJson("/api/v1/auth/verify-email", tokenBody("not-a-real-token"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("https://revisor.aydev.in/errors/invalid-token"));
        postJson("/api/v1/auth/verify-email", tokenBody(""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("https://revisor.aydev.in/errors/validation-failed"));
    }

    @Test
    void resendVerification_sendsAFreshLink_andRetiresTheOldOne() throws Exception {
        signup();
        String first = tokenFrom(emails.awaitMessage(1));

        postJson("/api/v1/auth/resend-verification", emailBody(EMAIL)).andExpect(status().isAccepted());
        String second = tokenFrom(emails.awaitMessage(2));

        assertThat(second).isNotEqualTo(first);
        postJson("/api/v1/auth/verify-email", tokenBody(first)).andExpect(status().isBadRequest());
        postJson("/api/v1/auth/verify-email", tokenBody(second)).andExpect(status().isOk());
    }

    @Test
    void resendVerification_is202ForUnknownAndAlreadyVerifiedAddresses_butSendsNothing() throws Exception {
        signup();
        postJson("/api/v1/auth/verify-email", tokenBody(tokenFrom(emails.awaitMessage(1)))).andExpect(status().isOk());

        postJson("/api/v1/auth/resend-verification", emailBody("nobody@example.com")).andExpect(status().isAccepted());
        postJson("/api/v1/auth/resend-verification", emailBody(EMAIL)).andExpect(status().isAccepted());

        emails.settle();
        assertThat(emails.messages()).hasSize(1);
    }

    @Test
    void passwordReset_setsTheNewPassword_signsOutEverySession_andTheLinkWorksOnce() throws Exception {
        signupAndVerify();
        Cookie session = refreshCookie(login(PASSWORD).andExpect(status().isOk()));

        postJson("/api/v1/auth/forgot-password", emailBody(EMAIL)).andExpect(status().isAccepted());
        EmailMessage email = emails.awaitMessage(2);
        assertThat(email.subject()).containsIgnoringCase("reset");
        assertThat(email.text()).contains("http://localhost:5173/reset-password?token=", "30 minutes");
        String token = tokenFrom(email);

        postJson("/api/v1/auth/reset-password", resetBody(token, NEW_PASSWORD)).andExpect(status().isNoContent());

        mvc.perform(post("/api/v1/auth/refresh").cookie(session)).andExpect(status().isUnauthorized());
        login(PASSWORD).andExpect(status().isUnauthorized());
        login(NEW_PASSWORD).andExpect(status().isOk());
        postJson("/api/v1/auth/reset-password", resetBody(token, "another-password"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("https://revisor.aydev.in/errors/invalid-token"));
    }

    @Test
    void passwordReset_alsoVerifiesAnUnverifiedAccount() throws Exception {
        signup();
        emails.awaitMessage(1);

        postJson("/api/v1/auth/forgot-password", emailBody(EMAIL)).andExpect(status().isAccepted());
        postJson("/api/v1/auth/reset-password", resetBody(tokenFrom(emails.awaitMessage(2)), NEW_PASSWORD))
                .andExpect(status().isNoContent());

        login(NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    void forgotPassword_is202ForUnknownAndDisabledAccounts_butSendsNothing() throws Exception {
        signupAndVerify();
        User user = userRepository.findByEmail(EMAIL).orElseThrow();
        user.setEnabled(false);
        userRepository.save(user);

        postJson("/api/v1/auth/forgot-password", emailBody("nobody@example.com")).andExpect(status().isAccepted());
        postJson("/api/v1/auth/forgot-password", emailBody(EMAIL)).andExpect(status().isAccepted());

        emails.settle();
        assertThat(emails.messages()).hasSize(1); // just the signup email
    }

    @Test
    void tokensOnlyWorkForTheirOwnPurpose_andAMismatchDoesNotUseThemUp() throws Exception {
        signup();
        String verifyToken = tokenFrom(emails.awaitMessage(1));

        postJson("/api/v1/auth/reset-password", resetBody(verifyToken, NEW_PASSWORD)).andExpect(status().isBadRequest());

        postJson("/api/v1/auth/verify-email", tokenBody(verifyToken)).andExpect(status().isOk());
        login(PASSWORD).andExpect(status().isOk());
    }

    @Test
    void resetPassword_enforcesThePasswordPolicy() throws Exception {
        postJson("/api/v1/auth/reset-password", resetBody("some-token", "short"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field=='newPassword')]").exists());
    }

    @Test
    void forgotPassword_isRateLimitedPerAddress_with429AndRetryAfter() throws Exception {
        for (int i = 0; i < AuthRateLimiter.EMAIL_SENDS_PER_ADDRESS; i++) {
            postJson("/api/v1/auth/forgot-password", emailBody("nobody@example.com")).andExpect(status().isAccepted());
        }

        postJson("/api/v1/auth/forgot-password", emailBody("Nobody@Example.com"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER));
        // Resending a verification email is counted separately.
        postJson("/api/v1/auth/resend-verification", emailBody("nobody@example.com")).andExpect(status().isAccepted());
    }

    private void signup() throws Exception {
        postJson("/api/v1/auth/signup", "{\"name\":\"Ann\",\"email\":\"" + EMAIL + "\",\"password\":\"" + PASSWORD
                + "\",\"timezone\":\"UTC\"}").andExpect(status().isCreated());
    }

    private void signupAndVerify() throws Exception {
        signup();
        postJson("/api/v1/auth/verify-email", tokenBody(tokenFrom(emails.awaitMessage(1)))).andExpect(status().isOk());
    }

    private ResultActions login(String password) throws Exception {
        return postJson("/api/v1/auth/login", "{\"email\":\"" + EMAIL + "\",\"password\":\"" + password + "\"}");
    }

    private ResultActions postJson(String url, String body) throws Exception {
        return mvc.perform(post(url)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static Cookie refreshCookie(ResultActions login) {
        List<String> cookies = login.andReturn().getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        String header = cookies.stream().filter(c -> c.startsWith(AuthCookies.REFRESH + "=")).findFirst().orElseThrow();
        return new Cookie(AuthCookies.REFRESH, header.substring(AuthCookies.REFRESH.length() + 1, header.indexOf(';')));
    }

    private static String tokenBody(String token) {
        return "{\"token\":\"" + token + "\"}";
    }

    private static String emailBody(String email) {
        return "{\"email\":\"" + email + "\"}";
    }

    private static String resetBody(String token, String password) {
        return "{\"token\":\"" + token + "\",\"newPassword\":\"" + password + "\"}";
    }
}
