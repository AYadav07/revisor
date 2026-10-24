package com.ay.revisor.course;

import com.ay.revisor.course.OutlineMerger.NewSubtopic;
import com.ay.revisor.course.OutlineMerger.NotesUpdate;
import com.ay.revisor.course.OutlineMerger.Plan;
import com.ay.revisor.course.OutlineMerger.TopicPlan;
import com.ay.revisor.shared.InvalidFieldsException;
import com.ay.revisor.shared.InvalidFieldsException.FieldProblem;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OutlineMergerTest {

    private static final List<TopicNode> CACHING_COURSE = List.of(
            new TopicNode(10L, "Caching", 0, List.of(
                    new SubtopicNode(100L, "Eviction policies", "LRU, LFU"),
                    new SubtopicNode(101L, "Write-through", null))),
            new TopicNode(11L, "Databases", 3, List.of()));

    @Test
    void emptyCourse_createsEveryTopicInOrder_withOrderIndexFromZero() {
        Plan plan = OutlineMerger.plan(List.of(), List.of(
                topic("Caching", sub("LRU", "notes"), sub("TTL", null)),
                topic("Databases")));

        assertThat(plan.topics()).containsExactly(
                new TopicPlan(null, "Caching", 0, List.of(new NewSubtopic("LRU", "notes"), new NewSubtopic("TTL", null))),
                new TopicPlan(null, "Databases", 1, List.of()));
        assertThat(plan.notesUpdates()).isEmpty();
        assertThat(plan.result()).isEqualTo(new OutlineResult(2, 0, 2, 0, 0));
    }

    @Test
    void topicMatchingAnExistingOne_ignoringCaseAndSpaces_mergesIntoIt_keepingItsTitle() {
        Plan plan = OutlineMerger.plan(CACHING_COURSE, List.of(topic("  caching ", sub("Read-through", null))));

        assertThat(plan.topics()).containsExactly(
                new TopicPlan(10L, "Caching", 0, List.of(new NewSubtopic("Read-through", null))));
        assertThat(plan.result()).isEqualTo(new OutlineResult(0, 1, 1, 0, 0));
    }

    @Test
    void newTopics_areAppendedAfterTheHighestExistingOrderIndex() {
        Plan plan = OutlineMerger.plan(CACHING_COURSE, List.of(topic("Queues"), topic("Streams")));

        assertThat(plan.topics()).extracting(TopicPlan::orderIndex).containsExactly(4, 5);
    }

    @Test
    void topicRepeatedInTheOutline_isMergedIntoOne() {
        Plan plan = OutlineMerger.plan(List.of(), List.of(
                topic("Queues", sub("Kafka", null)),
                topic("Streams"),
                topic("QUEUES", sub("RabbitMQ", null))));

        assertThat(plan.topics()).containsExactly(
                new TopicPlan(null, "Queues", 0, List.of(new NewSubtopic("Kafka", null), new NewSubtopic("RabbitMQ", null))),
                new TopicPlan(null, "Streams", 1, List.of()));
        assertThat(plan.result().topicsCreated()).isEqualTo(2);
    }

    @Test
    void existingSubtopic_withNoNotes_orTheSameNotes_isLeftAlone() {
        Plan noNotes = OutlineMerger.plan(CACHING_COURSE, List.of(topic("Caching",
                sub("eviction policies", "  "),
                new OutlineSubtopic("Write-through", null, ConflictResolution.OVERWRITE))));
        Plan sameNotes = OutlineMerger.plan(CACHING_COURSE, List.of(topic("Caching",
                new OutlineSubtopic("Eviction Policies ", " LRU, LFU\n", ConflictResolution.OVERWRITE))));

        assertThat(noNotes.notesUpdates()).isEmpty();
        assertThat(noNotes.topics().getFirst().newSubtopics()).isEmpty();
        assertThat(noNotes.result()).isEqualTo(new OutlineResult(0, 1, 0, 0, 2));
        assertThat(sameNotes.notesUpdates()).isEmpty();
        assertThat(sameNotes.result()).isEqualTo(new OutlineResult(0, 1, 0, 0, 1));
    }

    @Test
    void conflict_isSkippedByDefault_andOverwrittenOnRequest() {
        Plan skipped = OutlineMerger.plan(CACHING_COURSE, List.of(topic("Caching",
                new OutlineSubtopic("Eviction policies", "LRU, LFU, FIFO", null),
                new OutlineSubtopic("Write-through", "sync to DB", ConflictResolution.SKIP))));
        Plan overwritten = OutlineMerger.plan(CACHING_COURSE, List.of(topic("Caching",
                new OutlineSubtopic("Eviction policies", "LRU, LFU, FIFO", ConflictResolution.OVERWRITE))));

        assertThat(skipped.notesUpdates()).isEmpty();
        assertThat(skipped.result()).isEqualTo(new OutlineResult(0, 1, 0, 0, 2));
        assertThat(overwritten.notesUpdates()).containsExactly(new NotesUpdate(100L, "LRU, LFU, FIFO"));
        assertThat(overwritten.result()).isEqualTo(new OutlineResult(0, 1, 0, 1, 0));
    }

    @Test
    void sameSubtopicTwiceUnderOneTopic_isRejectedAtEachRepeat_evenAcrossRepeatedTopics() {
        assertThatThrownBy(() -> OutlineMerger.plan(List.of(), List.of(
                topic("Queues", sub("Kafka", null), sub("kafka", null)),
                topic("queues", sub("KAFKA", null)))))
                .isInstanceOfSatisfying(InvalidFieldsException.class, ex -> assertThat(ex.getProblems())
                        .extracting(FieldProblem::field)
                        .containsExactly("topics[0].subtopics[1].title", "topics[1].subtopics[0].title"));
    }

    @Test
    void sameSubtopicTitle_underDifferentTopics_isFine() {
        Plan plan = OutlineMerger.plan(List.of(), List.of(topic("A", sub("Intro", null)), topic("B", sub("Intro", null))));

        assertThat(plan.result().subtopicsCreated()).isEqualTo(2);
    }

    @Test
    void moreThanTheSubtopicLimitInTotal_isRejected() {
        List<OutlineSubtopic> half = new ArrayList<>();
        for (int i = 0; i < OutlineMerger.MAX_SUBTOPICS / 2 + 1; i++) {
            half.add(sub("S" + i, null));
        }

        assertThatThrownBy(() -> OutlineMerger.plan(List.of(), List.of(
                new OutlineTopic("A", half), new OutlineTopic("B", half))))
                .isInstanceOfSatisfying(InvalidFieldsException.class, ex -> assertThat(ex.getProblems())
                        .extracting(FieldProblem::field).containsExactly("topics"));
    }

    @Test
    void titlesAreTrimmed_andBlankNotesStoredAsNull() {
        Plan plan = OutlineMerger.plan(List.of(), List.of(topic("  Queues  ", sub("  Kafka ", "   "))));

        assertThat(plan.topics()).containsExactly(new TopicPlan(null, "Queues", 0, List.of(new NewSubtopic("Kafka", null))));
    }

    private static OutlineTopic topic(String title, OutlineSubtopic... subtopics) {
        return new OutlineTopic(title, List.of(subtopics));
    }

    private static OutlineSubtopic sub(String title, String notes) {
        return new OutlineSubtopic(title, notes, null);
    }
}
