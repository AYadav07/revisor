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

class CourseControllerTest extends ControllerTestBase {

    @Test
    void create_returns201WithTheCourse() throws Exception {
        TestUser ann = createUser("ann@example.com");

        mvc.perform(post("/api/v1/courses").cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"System Design\",\"description\":\"prep\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.title").value("System Design"))
                .andExpect(jsonPath("$.description").value("prep"));
    }

    @Test
    void create_withBlankTitle_is400WithFieldError() throws Exception {
        TestUser ann = createUser("ann@example.com");

        mvc.perform(post("/api/v1/courses").cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("https://revisor.dev/errors/validation-failed"))
                .andExpect(jsonPath("$.errors[0].field").value("title"));
    }

    @Test
    void everyEndpointRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/courses")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/courses").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"x\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/courses/1")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/courses/1")).andExpect(status().isUnauthorized());
    }

    @Test
    void list_returnsOnlyTheCallersCourses_inTheDocumentedPageShape() throws Exception {
        TestUser ann = createUser("ann@example.com");
        TestUser bob = createUser("bob@example.com");
        createCourse(ann, "A1");
        createCourse(ann, "A2");
        createCourse(ann, "A3");
        createCourse(bob, "B1");

        mvc.perform(get("/api/v1/courses").cookie(ann.cookie()).param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].title").value("A1"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get("/api/v1/courses").cookie(ann.cookie()).param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].title").value("A3"))
                .andExpect(jsonPath("$.page").value(1));
    }

    @Test
    void list_rejectsOutOfRangePagingWith400_notASilentClamp() throws Exception {
        TestUser ann = createUser("ann@example.com");

        mvc.perform(get("/api/v1/courses").cookie(ann.cookie()).param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("https://revisor.dev/errors/validation-failed"))
                .andExpect(jsonPath("$.errors[0].field").value("size"));
        mvc.perform(get("/api/v1/courses").cookie(ann.cookie()).param("size", "0")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/courses").cookie(ann.cookie()).param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("page"));
        mvc.perform(get("/api/v1/courses").cookie(ann.cookie()).param("page", "abc")).andExpect(status().isBadRequest());
    }

    @Test
    void get_returnsTheNestedTree_withoutSoftDeletedTopicsOrSubtopics() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "System Design");
        Long second = createTopic(ann, course, "Caching", 1);
        Long first = createTopic(ann, course, "Load Balancing", 0);
        Long doomedTopic = createTopic(ann, course, "Doomed", 2);
        Long kept = createSubtopic(ann, first, "L4 vs L7");
        Long doomedSub = createSubtopic(ann, first, "Doomed sub");
        createSubtopic(ann, doomedTopic, "Under doomed topic");
        mvc.perform(delete("/api/v1/subtopics/" + doomedSub).cookie(ann.cookie())).andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/topics/" + doomedTopic).cookie(ann.cookie())).andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/courses/" + course).cookie(ann.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("System Design"))
                .andExpect(jsonPath("$.topics.length()").value(2))
                .andExpect(jsonPath("$.topics[0].id").value(first))
                .andExpect(jsonPath("$.topics[0].orderIndex").value(0))
                .andExpect(jsonPath("$.topics[0].subtopics.length()").value(1))
                .andExpect(jsonPath("$.topics[0].subtopics[0].id").value(kept))
                .andExpect(jsonPath("$.topics[1].id").value(second))
                .andExpect(jsonPath("$.topics[1].subtopics.length()").value(0));
    }

    @Test
    void anotherUsersCourse_is404ForEveryOperation_neverForbidden() throws Exception {
        TestUser ann = createUser("ann@example.com");
        TestUser bob = createUser("bob@example.com");
        Long annsCourse = createCourse(ann, "Ann's");
        String url = "/api/v1/courses/" + annsCourse;

        mvc.perform(get(url).cookie(bob.cookie())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value("https://revisor.dev/errors/not-found"));
        mvc.perform(put(url).cookie(bob.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Hijacked\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete(url).cookie(bob.cookie())).andExpect(status().isNotFound());
        mvc.perform(post(url + "/topics").cookie(bob.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Planted\",\"orderIndex\":0}"))
                .andExpect(status().isNotFound());

        // ...and none of that touched it.
        mvc.perform(get(url).cookie(ann.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Ann's"))
                .andExpect(jsonPath("$.topics.length()").value(0));
    }

    @Test
    void update_changesTheCourse() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "Old");

        mvc.perform(put("/api/v1/courses/" + course).cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"New\",\"description\":\"d\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("New"));
        mvc.perform(get("/api/v1/courses/" + course).cookie(ann.cookie()))
                .andExpect(jsonPath("$.title").value("New"))
                .andExpect(jsonPath("$.description").value("d"));
    }

    @Test
    void delete_returns204_thenTheCourseIsGone_takingItsTreeWithIt() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "Doomed");
        Long topic = createTopic(ann, course, "T", 0);
        Long sub = createSubtopic(ann, topic, "S");

        mvc.perform(delete("/api/v1/courses/" + course).cookie(ann.cookie())).andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/courses/" + course).cookie(ann.cookie())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/topics/" + topic).cookie(ann.cookie())).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/subtopics/" + sub).cookie(ann.cookie())).andExpect(status().isNotFound());
    }

    @Test
    void nonNumericId_is400() throws Exception {
        TestUser ann = createUser("ann@example.com");

        mvc.perform(get("/api/v1/courses/abc").cookie(ann.cookie())).andExpect(status().isBadRequest());
    }
}
