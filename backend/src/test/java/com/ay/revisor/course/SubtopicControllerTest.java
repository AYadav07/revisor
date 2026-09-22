package com.ay.revisor.course;

import com.ay.revisor.support.ControllerTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SubtopicControllerTest extends ControllerTestBase {

    @Test
    void create_returns201WithTopicIdAndNotes() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long topic = createTopic(ann, createCourse(ann, "C"), "T", 0);

        mvc.perform(post("/api/v1/topics/" + topic + "/subtopics").cookie(ann.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"L4 vs L7\",\"notes\":\"n\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.topicId").value(topic))
                .andExpect(jsonPath("$.title").value("L4 vs L7"))
                .andExpect(jsonPath("$.notes").value("n"));
    }

    @Test
    void create_withBlankOrOverlongTitle_is400() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long topic = createTopic(ann, createCourse(ann, "C"), "T", 0);
        String url = "/api/v1/topics/" + topic + "/subtopics";

        mvc.perform(post(url).cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("title"));
        mvc.perform(post(url).cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + "x".repeat(256) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void malformedJson_is400ProblemDetail() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long topic = createTopic(ann, createCourse(ann, "C"), "T", 0);

        mvc.perform(post("/api/v1/topics/" + topic + "/subtopics").cookie(ann.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void getAndUpdate_workForTheOwner() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long sub = createSubtopic(ann, createTopic(ann, createCourse(ann, "C"), "T", 0), "Old");

        mvc.perform(put("/api/v1/subtopics/" + sub).cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"New\",\"notes\":\"changed\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/subtopics/" + sub).cookie(ann.cookie()))
                .andExpect(jsonPath("$.title").value("New"))
                .andExpect(jsonPath("$.notes").value("changed"));
    }

    @Test
    void delete_softDeletes_soItIsGoneFromReadsUpdatesAndTheCourseTree() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "C");
        Long sub = createSubtopic(ann, createTopic(ann, course, "T", 0), "S");

        mvc.perform(delete("/api/v1/subtopics/" + sub).cookie(ann.cookie())).andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/subtopics/" + sub).cookie(ann.cookie())).andExpect(status().isNotFound());
        mvc.perform(put("/api/v1/subtopics/" + sub).cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Zombie\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/subtopics/" + sub).cookie(ann.cookie())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/courses/" + course).cookie(ann.cookie()))
                .andExpect(jsonPath("$.topics[0].subtopics.length()").value(0));
    }

    @Test
    void anotherUsersSubtopic_is404ForEveryOperation_neverForbidden() throws Exception {
        TestUser ann = createUser("ann@example.com");
        TestUser bob = createUser("bob@example.com");
        Long annsSub = createSubtopic(ann, createTopic(ann, createCourse(ann, "Ann's"), "T", 0), "S");
        String url = "/api/v1/subtopics/" + annsSub;

        mvc.perform(get(url).cookie(bob.cookie())).andExpect(status().isNotFound());
        mvc.perform(put(url).cookie(bob.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Hijacked\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete(url).cookie(bob.cookie())).andExpect(status().isNotFound());

        mvc.perform(get(url).cookie(ann.cookie())).andExpect(status().isOk()).andExpect(jsonPath("$.title").value("S"));
    }

    @Test
    void endpointsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/v1/subtopics/1")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/subtopics/1")).andExpect(status().isUnauthorized());
    }
}
