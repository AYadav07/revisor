package com.ay.revisor.dashboard;

import com.ay.revisor.support.ControllerTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DashboardControllerTest extends ControllerTestBase {

    private static final Instant SEP_20 = Instant.parse("2026-09-20T10:00:00Z");
    private static final Instant SEP_22 = Instant.parse("2026-09-22T10:00:00Z");
    private static final Instant SEP_23 = Instant.parse("2026-09-23T10:00:00Z");

    /**
     * Builds, for ann (UTC), a course whose subtopics are due on different days, then moves "now" to Sep 23:
     * <pre>
     * overdue    learned Sep 20            -> due Sep 21 (2 days overdue on the 23rd)
     * dueToday   learned Sep 22            -> due Sep 23
     * dueTomorrow learned Sep 23           -> due Sep 24
     * farAhead   learned Sep 22, reviewed 3x -> due Oct 8
     * deleted    learned Sep 20, then soft-deleted -> due Sep 21, but must never appear
     * </pre>
     */
    private TestUser scheduleFixture(String email) throws Exception {
        clock.setInstant(SEP_22);
        TestUser user = createUser(email);
        Long course = createCourse(user, "System Design");
        Long topic = createTopic(user, course, "Caching", 0);
        Long overdue = createSubtopic(user, topic, "overdue");
        Long dueToday = createSubtopic(user, topic, "dueToday");
        Long dueTomorrow = createSubtopic(user, topic, "dueTomorrow");
        Long farAhead = createSubtopic(user, topic, "farAhead");
        Long deleted = createSubtopic(user, topic, "deleted");

        clock.setInstant(SEP_20);
        user = withFreshToken(user);
        learn(user, overdue);
        learn(user, deleted);
        mvc.perform(delete("/api/v1/subtopics/" + deleted).cookie(user.cookie())).andExpect(status().isNoContent());

        clock.setInstant(SEP_22);
        user = withFreshToken(user);
        learn(user, dueToday);
        learn(user, farAhead);
        review(user, farAhead, 4);
        review(user, farAhead, 5);
        review(user, farAhead, 5);

        clock.setInstant(SEP_23);
        user = withFreshToken(user);
        learn(user, dueTomorrow);
        return user;
    }

    @Test
    void due_today_listsOverdueAndDueTodayOldestFirst_excludingDeletedAndFutureItems() throws Exception {
        TestUser ann = scheduleFixture("ann@example.com");

        mvc.perform(get("/api/v1/dashboard/due").param("range", "today").cookie(ann.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].subtopicTitle").value("overdue"))
                .andExpect(jsonPath("$.content[0].nextReviewDate").value("2026-09-21"))
                .andExpect(jsonPath("$.content[0].daysOverdue").value(2))
                .andExpect(jsonPath("$.content[0].topicTitle").value("Caching"))
                .andExpect(jsonPath("$.content[0].courseTitle").value("System Design"))
                .andExpect(jsonPath("$.content[1].subtopicTitle").value("dueToday"))
                .andExpect(jsonPath("$.content[1].daysOverdue").value(0));

        // A full page makes the total come from a real count query. If soft-deleted subtopics leaked into
        // the schedule query it would say 3 here; a partial page can't show that, since Spring recomputes
        // the total from whatever content survives.
        mvc.perform(get("/api/v1/dashboard/due").param("range", "today").param("size", "1").cookie(ann.cookie()))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void due_week_extendsTheWindowSixDaysPastToday_butNotFurther() throws Exception {
        TestUser ann = scheduleFixture("ann@example.com");

        mvc.perform(get("/api/v1/dashboard/due").param("range", "week").cookie(ann.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[2].subtopicTitle").value("dueTomorrow"))
                .andExpect(jsonPath("$.content[2].daysOverdue").value(0));
    }

    @Test
    void due_rangeIsCaseInsensitive_andDefaultsToToday() throws Exception {
        TestUser ann = scheduleFixture("ann@example.com");

        mvc.perform(get("/api/v1/dashboard/due").param("range", "TODAY").cookie(ann.cookie()))
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/v1/dashboard/due").cookie(ann.cookie()))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void due_rejectsAnUnknownRangeAndOutOfRangePaging_with400() throws Exception {
        TestUser ann = createUser("ann@example.com");

        mvc.perform(get("/api/v1/dashboard/due").param("range", "month").cookie(ann.cookie()))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/dashboard/due").param("size", "101").cookie(ann.cookie()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("size"));
        mvc.perform(get("/api/v1/dashboard/due").param("page", "-1").cookie(ann.cookie()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void due_paginatesWithExactTotals() throws Exception {
        TestUser ann = scheduleFixture("ann@example.com");

        mvc.perform(get("/api/v1/dashboard/due").param("range", "week").param("size", "2").cookie(ann.cookie()))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get("/api/v1/dashboard/due").param("range", "week").param("size", "2").param("page", "1")
                        .cookie(ann.cookie()))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].subtopicTitle").value("dueTomorrow"));
    }

    @Test
    void due_measuresTodayInTheCallersOwnTimezone_notServerTime() throws Exception {
        // Honolulu is UTC-10. At 2026-09-21T20:00Z it is Sep 21 10:00 there, so a subtopic learned now is due Sep 22.
        clock.setInstant(Instant.parse("2026-09-21T20:00:00Z"));
        TestUser hana = createUserInZone("hana@example.com", "Pacific/Honolulu");
        Long sub = createSubtopic(hana, createTopic(hana, createCourse(hana, "C"), "T", 0), "S");
        learn(hana, sub);

        // At 2026-09-22T05:00Z it is already the 22nd in UTC, but still Sep 21 (19:00) in Honolulu.
        clock.setInstant(Instant.parse("2026-09-22T05:00:00Z"));
        hana = withFreshToken(hana);
        mvc.perform(get("/api/v1/dashboard/due").param("range", "today").cookie(hana.cookie()))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/dashboard/due").param("range", "week").cookie(hana.cookie()))
                .andExpect(jsonPath("$.totalElements").value(1));

        // Five hours later Honolulu has reached the 22nd, and the subtopic is due today.
        clock.setInstant(Instant.parse("2026-09-22T10:00:00Z"));
        hana = withFreshToken(hana);
        mvc.perform(get("/api/v1/dashboard/due").param("range", "today").cookie(hana.cookie()))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].daysOverdue").value(0));
    }

    @Test
    void due_neverShowsAnotherUsersSchedule() throws Exception {
        scheduleFixture("ann@example.com");
        clock.setInstant(SEP_23);
        TestUser bob = createUser("bob@example.com");

        mvc.perform(get("/api/v1/dashboard/due").param("range", "week").cookie(bob.cookie()))
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void summary_reportsTheStatTiles_excludingDeletedSubtopicsAndOtherUsers() throws Exception {
        TestUser ann = scheduleFixture("ann@example.com");
        clock.setInstant(SEP_23);
        TestUser bob = createUser("bob@example.com");

        // On Sep 23: overdue = the Sep 21 one, dueToday = the Sep 23 one; the soft-deleted Sep 21 one is invisible.
        // Learned & live: overdue, dueToday, dueTomorrow, farAhead.
        mvc.perform(get("/api/v1/dashboard/summary").cookie(ann.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dueToday").value(1))
                .andExpect(jsonPath("$.overdue").value(1))
                .andExpect(jsonPath("$.totalLearned").value(4));
        mvc.perform(get("/api/v1/dashboard/summary").cookie(bob.cookie()))
                .andExpect(jsonPath("$.dueToday").value(0))
                .andExpect(jsonPath("$.overdue").value(0))
                .andExpect(jsonPath("$.totalLearned").value(0));
    }

    @Test
    void summary_dueTodayPlusOverdueEqualsTheTodayListTotal() throws Exception {
        TestUser ann = scheduleFixture("ann@example.com");

        mvc.perform(get("/api/v1/dashboard/due").param("range", "today").cookie(ann.cookie()))
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/v1/dashboard/summary").cookie(ann.cookie()))
                .andExpect(jsonPath("$.dueToday").value(1))
                .andExpect(jsonPath("$.overdue").value(1));
    }

    @Test
    void summary_measuresTodayInTheCallersTimezone() throws Exception {
        // Honolulu (UTC-10): learned Sep 21 10:00 local -> due Sep 22 local.
        clock.setInstant(Instant.parse("2026-09-21T20:00:00Z"));
        TestUser hana = createUserInZone("hana@example.com", "Pacific/Honolulu");
        learn(hana, createSubtopic(hana, createTopic(hana, createCourse(hana, "C"), "T", 0), "S"));

        clock.setInstant(Instant.parse("2026-09-22T05:00:00Z"));   // Sep 21, 19:00 in Honolulu
        hana = withFreshToken(hana);
        mvc.perform(get("/api/v1/dashboard/summary").cookie(hana.cookie()))
                .andExpect(jsonPath("$.dueToday").value(0))
                .andExpect(jsonPath("$.overdue").value(0));

        clock.setInstant(Instant.parse("2026-09-22T10:00:00Z"));   // Sep 22, 00:00 in Honolulu
        hana = withFreshToken(hana);
        mvc.perform(get("/api/v1/dashboard/summary").cookie(hana.cookie()))
                .andExpect(jsonPath("$.dueToday").value(1));

        clock.setInstant(Instant.parse("2026-09-22T20:00:00Z"));   // Sep 22, 10:00 -> still today, not yet overdue
        hana = withFreshToken(hana);
        mvc.perform(get("/api/v1/dashboard/summary").cookie(hana.cookie()))
                .andExpect(jsonPath("$.dueToday").value(1))
                .andExpect(jsonPath("$.overdue").value(0));
    }

    @Test
    void progress_countsLearnedAndTotalLiveSubtopicsPerCourse_andIgnoresDeletedOnes() throws Exception {
        TestUser ann = scheduleFixture("ann@example.com");
        createCourse(ann, "Brand new");

        // 5 subtopics were created, 1 soft-deleted -> 4 live; learned & live: overdue, dueToday, dueTomorrow, farAhead.
        mvc.perform(get("/api/v1/dashboard/progress").cookie(ann.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].courseTitle").value("System Design"))
                .andExpect(jsonPath("$[0].learnedCount").value(4))
                .andExpect(jsonPath("$[0].totalCount").value(4))
                .andExpect(jsonPath("$[1].courseTitle").value("Brand new"))
                .andExpect(jsonPath("$[1].learnedCount").value(0))
                .andExpect(jsonPath("$[1].totalCount").value(0));
    }

    @Test
    void progress_onlyIncludesTheCallersCourses() throws Exception {
        TestUser ann = createUser("ann@example.com");
        TestUser bob = createUser("bob@example.com");
        createCourse(ann, "Ann's");

        mvc.perform(get("/api/v1/dashboard/progress").cookie(bob.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void endpointsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/v1/dashboard/due")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/dashboard/progress")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/dashboard/summary")).andExpect(status().isUnauthorized());
    }

    private void learn(TestUser user, Long subtopic) throws Exception {
        mvc.perform(post("/api/v1/subtopics/" + subtopic + "/learn").cookie(user.cookie())).andExpect(status().isOk());
    }

    private void review(TestUser user, Long subtopic, int quality) throws Exception {
        mvc.perform(post("/api/v1/subtopics/" + subtopic + "/review").cookie(user.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"quality\":" + quality + "}"))
                .andExpect(status().isOk());
    }
}
