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

class TopicControllerTest extends ControllerTestBase {

    @Test
    void create_returns201WithCourseIdAndOrderIndex() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "System Design");

        mvc.perform(post("/api/v1/courses/" + course + "/topics").cookie(ann.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Caching\",\"orderIndex\":3}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.courseId").value(course))
                .andExpect(jsonPath("$.title").value("Caching"))
                .andExpect(jsonPath("$.orderIndex").value(3));
    }

    @Test
    void create_withMissingOrderIndexOrBlankTitle_is400ListingEachField() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "System Design");

        mvc.perform(post("/api/v1/courses/" + course + "/topics").cookie(ann.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field=='title')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field=='orderIndex')]").exists());
    }

    @Test
    void getAndUpdate_workForTheOwner() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long topic = createTopic(ann, createCourse(ann, "C"), "Old", 0);

        mvc.perform(put("/api/v1/topics/" + topic).cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"New\",\"orderIndex\":5}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/topics/" + topic).cookie(ann.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("New"))
                .andExpect(jsonPath("$.orderIndex").value(5));
    }

    @Test
    void delete_softDeletesTheTopicAndCascadesToItsSubtopics() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long topic = createTopic(ann, createCourse(ann, "C"), "T", 0);
        Long sub = createSubtopic(ann, topic, "S");

        mvc.perform(delete("/api/v1/topics/" + topic).cookie(ann.cookie())).andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/topics/" + topic).cookie(ann.cookie())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/subtopics/" + sub).cookie(ann.cookie())).andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/topics/" + topic).cookie(ann.cookie())).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/topics/" + topic + "/subtopics").cookie(ann.cookie())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Late\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void anotherUsersTopic_is404ForEveryOperation_neverForbidden() throws Exception {
        TestUser ann = createUser("ann@example.com");
        TestUser bob = createUser("bob@example.com");
        Long annsTopic = createTopic(ann, createCourse(ann, "Ann's"), "T", 0);
        String url = "/api/v1/topics/" + annsTopic;

        mvc.perform(get(url).cookie(bob.cookie())).andExpect(status().isNotFound());
        mvc.perform(put(url).cookie(bob.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Hijacked\",\"orderIndex\":0}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete(url).cookie(bob.cookie())).andExpect(status().isNotFound());
        mvc.perform(post(url + "/subtopics").cookie(bob.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Planted\"}"))
                .andExpect(status().isNotFound());

        mvc.perform(get(url).cookie(ann.cookie())).andExpect(status().isOk()).andExpect(jsonPath("$.title").value("T"));
    }

    @Test
    void endpointsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/v1/topics/1")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/courses/1/topics").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"x\",\"orderIndex\":0}"))
                .andExpect(status().isUnauthorized());
    }
}
