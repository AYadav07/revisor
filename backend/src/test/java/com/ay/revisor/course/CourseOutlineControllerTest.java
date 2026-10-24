package com.ay.revisor.course;

import com.ay.revisor.support.ControllerTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** {@code POST /courses/import} and {@code POST /courses/{id}/outline} — API.md §Bulk outline import. */
class CourseOutlineControllerTest extends ControllerTestBase {

    @Test
    void import_returns201WithTheWholeTree_inOutlineOrder() throws Exception {
        TestUser ann = createUser("ann@example.com");

        mvc.perform(post("/api/v1/courses/import").cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": " System Design ", "description": "HLD prep", "topics": [
                                  {"title": "Caching", "subtopics": [
                                    {"title": "Eviction policies", "notes": "LRU, LFU"},
                                    {"title": "Write-through"}]},
                                  {"title": "Databases"}]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.title").value("System Design"))
                .andExpect(jsonPath("$.description").value("HLD prep"))
                .andExpect(jsonPath("$.topics.length()").value(2))
                .andExpect(jsonPath("$.topics[0].title").value("Caching"))
                .andExpect(jsonPath("$.topics[0].orderIndex").value(0))
                .andExpect(jsonPath("$.topics[0].subtopics[0].title").value("Eviction policies"))
                .andExpect(jsonPath("$.topics[0].subtopics[0].notes").value("LRU, LFU"))
                .andExpect(jsonPath("$.topics[0].subtopics[0].learned").value(false))
                .andExpect(jsonPath("$.topics[0].subtopics[1].title").value("Write-through"))
                .andExpect(jsonPath("$.topics[1].title").value("Databases"))
                .andExpect(jsonPath("$.topics[1].subtopics.length()").value(0));
    }

    @Test
    void import_withInvalidEntries_is400WithIndexedFieldPaths_andCreatesNothing() throws Exception {
        TestUser ann = createUser("ann@example.com");

        mvc.perform(post("/api/v1/courses/import").cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "SD", "topics": [
                                  {"title": "Caching", "subtopics": [{"title": "ok"}, {"title": " "}]}]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("https://revisor.aydev.in/errors/validation-failed"))
                .andExpect(jsonPath("$.errors[0].field").value("topics[0].subtopics[1].title"));
        mvc.perform(post("/api/v1/courses/import").cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "SD", "topics": [
                                  {"title": "Caching", "subtopics": [{"title": "LRU"}, {"title": "lru"}]}]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("https://revisor.aydev.in/errors/validation-failed"))
                .andExpect(jsonPath("$.errors[0].field").value("topics[0].subtopics[1].title"));

        mvc.perform(get("/api/v1/courses").cookie(ann.cookie())).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void import_withNoTopics_is400() throws Exception {
        TestUser ann = createUser("ann@example.com");

        mvc.perform(post("/api/v1/courses/import").cookie(ann.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"SD\", \"topics\": []}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("topics"));
    }

    @Test
    void outline_mergesTopicsByTitle_appendsNewOnes_andResolvesConflictsAsAsked() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "SD");
        Long caching = createTopic(ann, course, "Caching", 0);
        Long eviction = createSubtopic(ann, caching, "Eviction policies");
        Long writeThrough = createSubtopic(ann, caching, "Write-through");
        setNotes(ann, eviction, "Eviction policies", "LRU");
        setNotes(ann, writeThrough, "Write-through", "old");

        mvc.perform(post("/api/v1/courses/" + course + "/outline").cookie(ann.cookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"topics": [
                                  {"title": "caching", "subtopics": [
                                    {"title": "eviction policies", "notes": "LRU, LFU", "onConflict": "OVERWRITE"},
                                    {"title": "Write-through", "notes": "new", "onConflict": "SKIP"},
                                    {"title": "Read-through"}]},
                                  {"title": "Queues", "subtopics": [{"title": "Kafka"}]}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topicsCreated").value(1))
                .andExpect(jsonPath("$.topicsMerged").value(1))
                .andExpect(jsonPath("$.subtopicsCreated").value(2))
                .andExpect(jsonPath("$.subtopicsUpdated").value(1))
                .andExpect(jsonPath("$.subtopicsSkipped").value(1));

        mvc.perform(get("/api/v1/courses/" + course).cookie(ann.cookie()))
                .andExpect(jsonPath("$.topics.length()").value(2))
                .andExpect(jsonPath("$.topics[0].title").value("Caching"))
                .andExpect(jsonPath("$.topics[0].subtopics.length()").value(3))
                .andExpect(jsonPath("$.topics[0].subtopics[0].title").value("Eviction policies"))
                .andExpect(jsonPath("$.topics[0].subtopics[0].notes").value("LRU, LFU"))
                .andExpect(jsonPath("$.topics[0].subtopics[1].notes").value("old"))
                .andExpect(jsonPath("$.topics[0].subtopics[2].title").value("Read-through"))
                .andExpect(jsonPath("$.topics[1].title").value("Queues"))
                .andExpect(jsonPath("$.topics[1].orderIndex").value(1))
                .andExpect(jsonPath("$.topics[1].subtopics[0].title").value("Kafka"));
    }

    @Test
    void outline_keepsTheLearningStateOfAnOverwrittenSubtopic() throws Exception {
        TestUser ann = createUser("ann@example.com");
        Long course = createCourse(ann, "SD");
        Long topic = createTopic(ann, course, "Caching", 0);
        Long subtopic = createSubtopic(ann, topic, "LRU");
        mvc.perform(post("/api/v1/subtopics/" + subtopic + "/learn").cookie(ann.cookie())).andExpect(status().isOk());

        mvc.perform(post("/api/v1/courses/" + course + "/outline").cookie(ann.cookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"topics": [{"title": "Caching", "subtopics": [
                                  {"title": "LRU", "notes": "least recently used", "onConflict": "OVERWRITE"}]}]}
                                """))
                .andExpect(jsonPath("$.subtopicsUpdated").value(1));

        mvc.perform(get("/api/v1/courses/" + course).cookie(ann.cookie()))
                .andExpect(jsonPath("$.topics[0].subtopics[0].id").value(subtopic))
                .andExpect(jsonPath("$.topics[0].subtopics[0].notes").value("least recently used"))
                .andExpect(jsonPath("$.topics[0].subtopics[0].learned").value(true));
    }

    @Test
    void outline_onSomeoneElsesCourse_is404() throws Exception {
        TestUser ann = createUser("ann@example.com");
        TestUser bob = createUser("bob@example.com");
        Long bobsCourse = createCourse(bob, "Bob's");

        mvc.perform(post("/api/v1/courses/" + bobsCourse + "/outline").cookie(ann.cookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topics\": [{\"title\": \"Sneaky\"}]}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/courses/" + bobsCourse).cookie(bob.cookie()))
                .andExpect(jsonPath("$.topics.length()").value(0));
    }

    @Test
    void bothEndpointsRequireAuthentication() throws Exception {
        mvc.perform(post("/api/v1/courses/import").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/courses/1/outline").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    private void setNotes(TestUser owner, Long subtopicId, String title, String notes) throws Exception {
        mvc.perform(put("/api/v1/subtopics/" + subtopicId).cookie(owner.cookie()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"notes\":\"" + notes + "\"}"))
                .andExpect(status().isOk());
    }
}
