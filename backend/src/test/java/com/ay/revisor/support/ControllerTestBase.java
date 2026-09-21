package com.ay.revisor.support;

import com.ay.revisor.auth.AccessTokenIssuer;
import com.ay.revisor.auth.Role;
import com.ay.revisor.auth.User;
import com.ay.revisor.auth.UserRepository;
import com.ay.revisor.auth.UserResponse;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Full-context controller tests over the real security chain and in-memory H2. Users are
 * inserted directly and given a genuine access-token cookie, so tests exercise the same JWT
 * filter a browser would — and can create several users to check ownership isolation.
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class ControllerTestBase {

    @Autowired
    protected MockMvc mvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private AccessTokenIssuer accessTokenIssuer;

    /** Deleting users cascades (FK ON DELETE CASCADE) to everything they own. */
    @AfterEach
    void deleteAllUsers() {
        userRepository.deleteAll();
    }

    protected TestUser createUser(String email, Role role) {
        User user = userRepository.save(new User("Test " + email, email, "not-a-real-hash", role, true, "UTC"));
        Instant now = Instant.now();
        String token = accessTokenIssuer.issue(
                new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getRole(), true, "UTC", now), now);
        return new TestUser(user.getId(), new Cookie("accessToken", token));
    }

    protected TestUser createUser(String email) {
        return createUser(email, Role.USER);
    }

    protected Long createCourse(TestUser owner, String title) throws Exception {
        return postForId(owner, "/api/v1/courses", "{\"title\":\"" + title + "\"}");
    }

    protected Long createTopic(TestUser owner, Long courseId, String title, int orderIndex) throws Exception {
        return postForId(owner, "/api/v1/courses/" + courseId + "/topics",
                "{\"title\":\"" + title + "\",\"orderIndex\":" + orderIndex + "}");
    }

    protected Long createSubtopic(TestUser owner, Long topicId, String title) throws Exception {
        return postForId(owner, "/api/v1/topics/" + topicId + "/subtopics", "{\"title\":\"" + title + "\"}");
    }

    private Long postForId(TestUser owner, String url, String body) throws Exception {
        MvcResult result = mvc.perform(post(url).cookie(owner.cookie()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
        return JsonPath.<Number>read(result.getResponse().getContentAsString(), "$.id").longValue();
    }

    public record TestUser(Long id, Cookie cookie) {
    }
}
