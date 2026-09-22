package com.ay.revisor.admin;

import com.ay.revisor.auth.RefreshToken;
import com.ay.revisor.auth.RefreshTokenRepository;
import com.ay.revisor.auth.Role;
import com.ay.revisor.auth.UserRepository;
import com.ay.revisor.support.ControllerTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminControllerTest extends ControllerTestBase {

    @Autowired
    private AdminActionRepository adminActionRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    @Autowired
    private UserRepository userRepository;

    /** Audit rows deliberately outlive users (no FK), so they aren't cleaned up by deleting users. */
    @AfterEach
    void clearAuditLog() {
        adminActionRepository.deleteAll();
    }

    // ---- access control -------------------------------------------------------------------

    @Test
    void everyEndpoint_is403ProblemDetailForANonAdmin_andWritesNoAuditRow() throws Exception {
        TestUser ann = createUser("ann@example.com");
        String url = "/api/v1/admin/users/" + ann.id();

        mvc.perform(get("/api/v1/admin/users").cookie(ann.cookie()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value("https://revisor.dev/errors/forbidden"))
                .andExpect(jsonPath("$.status").value(403));
        mvc.perform(patch(url).cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete(url).cookie(ann.cookie())).andExpect(status().isForbidden());
        mvc.perform(get(url + "/courses").cookie(ann.cookie())).andExpect(status().isForbidden());

        assertThat(adminActionRepository.findAll()).isEmpty();
        assertThat(userRepository.findById(ann.id())).get().extracting(u -> u.isEnabled()).isEqualTo(true);
    }

    @Test
    void everyEndpoint_is401WhenUnauthenticated() throws Exception {
        mvc.perform(get("/api/v1/admin/users")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/v1/admin/users/1").contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/admin/users/1")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/users/1/courses")).andExpect(status().isUnauthorized());
    }

    // ---- list / search --------------------------------------------------------------------

    @Test
    void list_returnsEveryUserInThePageShape_withoutPasswordHashes_andLogsTheView() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);
        createUser("ann@example.com");
        createUser("bob@example.com");

        mvc.perform(get("/api/v1/admin/users").cookie(admin.cookie()).param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.content[0].email").value("admin@example.com"))
                .andExpect(jsonPath("$.content[0].role").value("ADMIN"))
                .andExpect(jsonPath("$.content[0].enabled").value(true))
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist());

        assertLogged(admin, AdminActionType.LIST_USERS, null);
    }

    @Test
    void list_searchMatchesNameOrEmailCaseInsensitively() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);
        createUser("ann@example.com");
        createUser("bob@other.org");

        mvc.perform(get("/api/v1/admin/users").cookie(admin.cookie()).param("q", "ANN"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].email").value("ann@example.com"));
        mvc.perform(get("/api/v1/admin/users").cookie(admin.cookie()).param("q", "other.org"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].email").value("bob@other.org"));
        mvc.perform(get("/api/v1/admin/users").cookie(admin.cookie()).param("q", "nobody"))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/admin/users").cookie(admin.cookie()).param("q", "  "))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void list_rejectsOutOfRangePaging() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);

        mvc.perform(get("/api/v1/admin/users").cookie(admin.cookie()).param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("size"));
        assertThat(adminActionRepository.findAll()).isEmpty();
    }

    // ---- disable / enable -----------------------------------------------------------------

    @Test
    void disable_setsEnabledFalse_revokesEveryRefreshToken_andLogsIt() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);
        TestUser ann = createUser("ann@example.com");
        refreshTokenRepository.save(new RefreshToken(ann.id(), UUID.randomUUID(), "hash-a", Instant.now().plusSeconds(3600)));
        refreshTokenRepository.save(new RefreshToken(ann.id(), UUID.randomUUID(), "hash-b", Instant.now().plusSeconds(3600)));

        mvc.perform(patch("/api/v1/admin/users/" + ann.id()).cookie(admin.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ann.id()))
                .andExpect(jsonPath("$.enabled").value(false));

        assertThat(userRepository.findById(ann.id())).get().extracting(u -> u.isEnabled()).isEqualTo(false);
        assertThat(refreshTokenRepository.findAll()).hasSize(2)
                .allSatisfy(token -> assertThat(token.getRevokedAt()).isNotNull());
        assertLogged(admin, AdminActionType.DISABLE_USER, ann.id());
    }

    @Test
    void enable_setsEnabledTrue_andLogsIt() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);
        TestUser ann = createUser("ann@example.com");
        disable(admin, ann);
        adminActionRepository.deleteAll();

        mvc.perform(patch("/api/v1/admin/users/" + ann.id()).cookie(admin.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));

        assertLogged(admin, AdminActionType.ENABLE_USER, ann.id());
    }

    @Test
    void disable_ownAccount_is409_andChangesAndLogsNothing() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);

        mvc.perform(patch("/api/v1/admin/users/" + admin.id()).cookie(admin.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("https://revisor.dev/errors/conflict"));

        assertThat(userRepository.findById(admin.id())).get().extracting(u -> u.isEnabled()).isEqualTo(true);
        assertThat(adminActionRepository.findAll()).isEmpty();
    }

    @Test
    void patch_unknownUser_is404_missingFlag_is400() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);
        TestUser ann = createUser("ann@example.com");

        mvc.perform(patch("/api/v1/admin/users/999999").cookie(admin.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/api/v1/admin/users/" + ann.id()).cookie(admin.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("enabled"));
        assertThat(adminActionRepository.findAll()).isEmpty();
    }

    // ---- delete ---------------------------------------------------------------------------

    @Test
    void delete_isRefusedWith409UntilTheUserIsDisabled() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);
        TestUser ann = createUser("ann@example.com");

        mvc.perform(delete("/api/v1/admin/users/" + ann.id()).cookie(admin.cookie())).andExpect(status().isConflict());

        assertThat(userRepository.findById(ann.id())).isPresent();
        assertThat(adminActionRepository.findAll()).isEmpty();
    }

    @Test
    void delete_afterDisabling_removesTheUserAndAllTheirData_butTheAuditRowKeepsTheirId() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "Ann's course");
        Long sub = createSubtopic(ann, createTopic(ann, course, "T", 0), "S");
        mvc.perform(post("/api/v1/subtopics/" + sub + "/learn").cookie(ann.cookie())).andExpect(status().isOk());
        refreshTokenRepository.save(new RefreshToken(ann.id(), UUID.randomUUID(), "hash-a", Instant.now().plusSeconds(3600)));
        disable(admin, ann);
        adminActionRepository.deleteAll();

        mvc.perform(delete("/api/v1/admin/users/" + ann.id()).cookie(admin.cookie())).andExpect(status().isNoContent());

        assertThat(userRepository.findById(ann.id())).isEmpty();
        assertThat(refreshTokenRepository.findAll()).isEmpty();
        // ARCHITECTURE.md §7: the audit log must still say who was deleted — the reason the V2 migration
        // dropped the foreign keys that would have nulled this out.
        assertLogged(admin, AdminActionType.DELETE_USER, ann.id());
    }

    @Test
    void delete_ownAccount_is409() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);

        mvc.perform(delete("/api/v1/admin/users/" + admin.id()).cookie(admin.cookie())).andExpect(status().isConflict());

        assertThat(userRepository.findById(admin.id())).isPresent();
    }

    @Test
    void delete_unknownUser_is404() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);

        mvc.perform(delete("/api/v1/admin/users/999999").cookie(admin.cookie())).andExpect(status().isNotFound());
    }

    // ---- read-only view of a user's courses ------------------------------------------------

    @Test
    void userCourses_showsThatUsersCoursesWithProgress_andLogsTheView() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "System Design");
        Long topic = createTopic(ann, course, "Caching", 0);
        Long learned = createSubtopic(ann, topic, "Learned");
        createSubtopic(ann, topic, "Not yet");
        createCourse(ann, "Empty");
        mvc.perform(post("/api/v1/subtopics/" + learned + "/learn").cookie(ann.cookie())).andExpect(status().isOk());

        mvc.perform(get("/api/v1/admin/users/" + ann.id() + "/courses").cookie(admin.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].title").value("System Design"))
                .andExpect(jsonPath("$.content[0].learnedCount").value(1))
                .andExpect(jsonPath("$.content[0].totalCount").value(2))
                .andExpect(jsonPath("$.content[1].title").value("Empty"))
                .andExpect(jsonPath("$.content[1].learnedCount").value(0))
                .andExpect(jsonPath("$.content[1].totalCount").value(0));

        assertLogged(admin, AdminActionType.VIEW_USER_COURSES, ann.id());
    }

    @Test
    void userCourses_forAnUnknownUser_is404_andIsNotLogged() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);

        mvc.perform(get("/api/v1/admin/users/999999/courses").cookie(admin.cookie())).andExpect(status().isNotFound());

        assertThat(adminActionRepository.findAll()).isEmpty();
    }

    @Test
    void theViewIsReadOnly_anAdminStillCannotTouchAnotherUsersCoursesThroughTheNormalEndpoints() throws Exception {
        TestUser admin = createUser("admin@example.com", Role.ADMIN);
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "Ann's");

        mvc.perform(get("/api/v1/courses/" + course).cookie(admin.cookie())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/courses/" + course).cookie(admin.cookie())).andExpect(status().isNotFound());
    }

    // ---- helpers --------------------------------------------------------------------------

    private void disable(TestUser admin, TestUser target) throws Exception {
        mvc.perform(patch("/api/v1/admin/users/" + target.id()).cookie(admin.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isOk());
    }

    private void assertLogged(TestUser admin, AdminActionType type, Long targetUserId) {
        List<AdminAction> actions = adminActionRepository.findAll();
        assertThat(actions).hasSize(1);
        assertThat(actions.get(0).getAdminUserId()).isEqualTo(admin.id());
        assertThat(actions.get(0).getAction()).isEqualTo(type.name());
        assertThat(actions.get(0).getTargetUserId()).isEqualTo(targetUserId);
        assertThat(actions.get(0).getTimestamp()).isNotNull();
    }
}
