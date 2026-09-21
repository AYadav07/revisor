package com.ay.revisor.review;

import com.ay.revisor.support.ControllerTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ReviewControllerTest extends ControllerTestBase {

    // 2026-09-22T20:00Z is already 2026-09-23 01:30 in Asia/Kolkata (UTC+5:30), but still 09-22 in UTC.
    private static final Instant LATE_EVENING_UTC = Instant.parse("2026-09-22T20:00:00Z");

    @Test
    void learn_returns200_andSchedulesTheFirstReviewOneDayAheadInTheUsersOwnTimezone() throws Exception {
        clock.setInstant(LATE_EVENING_UTC);
        TestUser ann = createUserInZone("ann@example.com", "Asia/Kolkata");
        Long sub = newSubtopic(ann);

        mvc.perform(post("/api/v1/subtopics/" + sub + "/learn").cookie(ann.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subtopicId").value(sub))
                .andExpect(jsonPath("$.learnedAt").value("2026-09-22T20:00:00Z"))
                // Kolkata's "today" is the 23rd, so tomorrow is the 24th — UTC would have said the 23rd.
                .andExpect(jsonPath("$.nextReviewDate").value("2026-09-24"));
    }

    @Test
    void learn_isIdempotent_returningTheOriginalRecordUnchanged() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long sub = newSubtopic(ann);
        mvc.perform(post("/api/v1/subtopics/" + sub + "/learn").cookie(ann.cookie())).andExpect(status().isOk());

        // Later, but inside the access token's 15-minute life.
        clock.setInstant(Instant.parse("2026-09-22T10:10:00Z"));
        mvc.perform(post("/api/v1/subtopics/" + sub + "/learn").cookie(ann.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.learnedAt").value("2026-09-22T10:00:00Z"))
                .andExpect(jsonPath("$.nextReviewDate").value("2026-09-23"));
    }

    @Test
    void review_beforeLearn_is409Conflict() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long sub = newSubtopic(ann);

        mvc.perform(post("/api/v1/subtopics/" + sub + "/review").cookie(ann.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"quality\":4}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("https://revisor.dev/errors/conflict"));
    }

    @Test
    void review_advancesThroughTheSm2Schedule_thenResetsOnAFailingGrade() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long sub = newSubtopic(ann);
        mvc.perform(post("/api/v1/subtopics/" + sub + "/learn").cookie(ann.cookie())).andExpect(status().isOk());

        // 1st successful review: interval 1 day, ease unchanged at quality 4.
        review(ann, sub, 4).andExpect(status().isOk())
                .andExpect(jsonPath("$.subtopicId").value(sub))
                .andExpect(jsonPath("$.repetitionCount").value(1))
                .andExpect(jsonPath("$.intervalDays").value(1))
                .andExpect(jsonPath("$.easeFactor").value(2.5))
                .andExpect(jsonPath("$.nextReviewDate").value("2026-09-23"));
        // 2nd: interval jumps to 6 days; quality 5 raises ease by 0.1.
        review(ann, sub, 5).andExpect(status().isOk())
                .andExpect(jsonPath("$.repetitionCount").value(2))
                .andExpect(jsonPath("$.intervalDays").value(6))
                .andExpect(jsonPath("$.easeFactor").value(2.6))
                .andExpect(jsonPath("$.nextReviewDate").value("2026-09-28"));
        // A failing grade resets repetitions and interval; ease is left as it was.
        review(ann, sub, 1).andExpect(status().isOk())
                .andExpect(jsonPath("$.repetitionCount").value(0))
                .andExpect(jsonPath("$.intervalDays").value(1))
                .andExpect(jsonPath("$.easeFactor").value(2.6))
                .andExpect(jsonPath("$.nextReviewDate").value("2026-09-23"));
    }

    @Test
    void review_rejectsOutOfRangeOrMissingQuality_with400() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long sub = newSubtopic(ann);
        mvc.perform(post("/api/v1/subtopics/" + sub + "/learn").cookie(ann.cookie())).andExpect(status().isOk());

        for (String body : new String[]{"{\"quality\":6}", "{\"quality\":-1}", "{}"}) {
            mvc.perform(post("/api/v1/subtopics/" + sub + "/review").cookie(ann.cookie())
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[0].field").value("quality"));
        }
    }

    @Test
    void anotherUsersSubtopic_is404NotAnInformationLeakingConflict() throws Exception {
        TestUser ann = createUser("ann@example.com");
        TestUser bob = createUser("bob@example.com");
        Long annsSub = newSubtopic(ann);
        mvc.perform(post("/api/v1/subtopics/" + annsSub + "/learn").cookie(ann.cookie())).andExpect(status().isOk());

        // 404 — not 409 "not learned yet", which would confirm the subtopic exists and reveal its state.
        mvc.perform(post("/api/v1/subtopics/" + annsSub + "/learn").cookie(bob.cookie())).andExpect(status().isNotFound());
        review(bob, annsSub, 4).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/subtopics/999999/learn").cookie(bob.cookie())).andExpect(status().isNotFound());
    }

    @Test
    void aSoftDeletedSubtopic_cannotBeLearnedOrReviewed() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long sub = newSubtopic(ann);
        mvc.perform(post("/api/v1/subtopics/" + sub + "/learn").cookie(ann.cookie())).andExpect(status().isOk());
        mvc.perform(delete("/api/v1/subtopics/" + sub).cookie(ann.cookie())).andExpect(status().isNoContent());

        mvc.perform(post("/api/v1/subtopics/" + sub + "/learn").cookie(ann.cookie())).andExpect(status().isNotFound());
        review(ann, sub, 4).andExpect(status().isNotFound());
    }

    @Test
    void endpointsRequireAuthentication() throws Exception {
        mvc.perform(post("/api/v1/subtopics/1/learn")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/subtopics/1/review").contentType(MediaType.APPLICATION_JSON).content("{\"quality\":4}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void courseTree_reportsLearnedAndNextReviewDatePerSubtopic() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "System Design");
        Long topic = createTopic(ann, course, "Caching", 0);
        Long learned = createSubtopic(ann, topic, "Learned one");
        createSubtopic(ann, topic, "Untouched one");
        mvc.perform(post("/api/v1/subtopics/" + learned + "/learn").cookie(ann.cookie())).andExpect(status().isOk());

        mvc.perform(get("/api/v1/courses/" + course).cookie(ann.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topics[0].subtopics[0].title").value("Learned one"))
                .andExpect(jsonPath("$.topics[0].subtopics[0].learned").value(true))
                .andExpect(jsonPath("$.topics[0].subtopics[0].nextReviewDate").value("2026-09-23"))
                .andExpect(jsonPath("$.topics[0].subtopics[1].title").value("Untouched one"))
                .andExpect(jsonPath("$.topics[0].subtopics[1].learned").value(false))
                .andExpect(jsonPath("$.topics[0].subtopics[1].nextReviewDate").doesNotExist());
    }

    private Long newSubtopic(TestUser owner) throws Exception {
        return createSubtopic(owner, createTopic(owner, createCourse(owner, "C"), "T", 0), "S");
    }

    private org.springframework.test.web.servlet.ResultActions review(TestUser user, Long subtopic, int quality)
            throws Exception {
        return mvc.perform(post("/api/v1/subtopics/" + subtopic + "/review").cookie(user.cookie())
                .contentType(MediaType.APPLICATION_JSON).content("{\"quality\":" + quality + "}"));
    }
}
