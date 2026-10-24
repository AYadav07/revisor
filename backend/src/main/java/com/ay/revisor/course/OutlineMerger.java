package com.ay.revisor.course;

import com.ay.revisor.shared.InvalidFieldsException;
import com.ay.revisor.shared.InvalidFieldsException.FieldProblem;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Pure match/merge/conflict rules for bulk outline import — no Spring/JPA dependencies,
 * unit-testable in isolation. Given a course's current (live) topics and an outline, it
 * decides what to create, what to overwrite and what to leave alone. The rules are in
 * API.md §Bulk outline import; this class is their single authoritative implementation.
 */
public final class OutlineMerger {

    public static final int MAX_TOPICS = 100;
    public static final int MAX_SUBTOPICS = 1000;

    private OutlineMerger() {
    }

    public record NewSubtopic(String title, String notes) {
    }

    /** One topic to write to: an existing one ({@code existingTopicId} set) or a new one to create. */
    public record TopicPlan(Long existingTopicId, String title, int orderIndex, List<NewSubtopic> newSubtopics) {
    }

    public record NotesUpdate(Long subtopicId, String notes) {
    }

    public record Plan(List<TopicPlan> topics, List<NotesUpdate> notesUpdates, OutlineResult result) {
    }

    /**
     * @param existingTopics the course's live topics in display order, with their live subtopics
     * @throws InvalidFieldsException if the outline has more than {@link #MAX_SUBTOPICS} subtopics, or
     *                                repeats a subtopic under one topic (after merging repeated topics)
     */
    public static Plan plan(List<TopicNode> existingTopics, List<OutlineTopic> outline) {
        int subtopicCount = outline.stream().mapToInt(topic -> topic.subtopics().size()).sum();
        if (subtopicCount > MAX_SUBTOPICS) {
            throw new InvalidFieldsException(List.of(new FieldProblem("topics",
                    "must contain at most " + MAX_SUBTOPICS + " subtopics in total")));
        }

        Map<String, TopicNode> existingByKey = new LinkedHashMap<>();
        int nextOrderIndex = 0;
        for (TopicNode topic : existingTopics) {
            existingByKey.putIfAbsent(key(topic.title()), topic);
            nextOrderIndex = Math.max(nextOrderIndex, topic.orderIndex() + 1);
        }

        Map<String, TopicDraft> drafts = new LinkedHashMap<>();
        List<NotesUpdate> notesUpdates = new ArrayList<>();
        List<FieldProblem> problems = new ArrayList<>();
        int created = 0;
        int updated = 0;
        int skipped = 0;

        for (int i = 0; i < outline.size(); i++) {
            OutlineTopic topic = outline.get(i);
            String topicKey = key(topic.title());
            TopicDraft draft = drafts.get(topicKey);
            if (draft == null) {
                TopicNode existing = existingByKey.get(topicKey);
                draft = existing != null
                        ? TopicDraft.of(existing)
                        : new TopicDraft(null, topic.title().strip(), nextOrderIndex++, Map.of());
                drafts.put(topicKey, draft);
            }

            for (int j = 0; j < topic.subtopics().size(); j++) {
                OutlineSubtopic subtopic = topic.subtopics().get(j);
                String subtopicKey = key(subtopic.title());
                if (!draft.seenKeys.add(subtopicKey)) {
                    problems.add(new FieldProblem("topics[" + i + "].subtopics[" + j + "].title",
                            "appears more than once in this topic"));
                    continue;
                }
                String notes = blankToNull(subtopic.notes());
                SubtopicNode match = draft.existingSubtopics.get(subtopicKey);
                if (match == null) {
                    draft.newSubtopics.add(new NewSubtopic(subtopic.title().strip(), notes));
                    created++;
                } else if (notes == null || sameNotes(notes, match.notes())
                        || subtopic.onConflict() != ConflictResolution.OVERWRITE) {
                    skipped++;
                } else {
                    notesUpdates.add(new NotesUpdate(match.id(), notes));
                    updated++;
                }
            }
        }

        if (!problems.isEmpty()) {
            throw new InvalidFieldsException(problems);
        }

        List<TopicPlan> topics = drafts.values().stream()
                .map(draft -> new TopicPlan(draft.existingTopicId, draft.title, draft.orderIndex,
                        List.copyOf(draft.newSubtopics)))
                .toList();
        int topicsMerged = (int) topics.stream().filter(topic -> topic.existingTopicId() != null).count();
        OutlineResult result = new OutlineResult(topics.size() - topicsMerged, topicsMerged, created, updated, skipped);
        return new Plan(topics, List.copyOf(notesUpdates), result);
    }

    /** Titles match trimmed and case-insensitively. */
    private static String key(String title) {
        return title.strip().toLowerCase(Locale.ROOT);
    }

    private static String blankToNull(String notes) {
        return notes == null || notes.isBlank() ? null : notes;
    }

    private static boolean sameNotes(String incoming, String existing) {
        return Objects.equals(incoming.strip(), existing == null ? "" : existing.strip());
    }

    private static final class TopicDraft {
        private final Long existingTopicId;
        private final String title;
        private final int orderIndex;
        /** First live subtopic per title key; duplicates already in the course match the oldest. */
        private final Map<String, SubtopicNode> existingSubtopics;
        private final Set<String> seenKeys = new HashSet<>();
        private final List<NewSubtopic> newSubtopics = new ArrayList<>();

        private TopicDraft(Long existingTopicId, String title, int orderIndex, Map<String, SubtopicNode> existingSubtopics) {
            this.existingTopicId = existingTopicId;
            this.title = title;
            this.orderIndex = orderIndex;
            this.existingSubtopics = existingSubtopics;
        }

        private static TopicDraft of(TopicNode topic) {
            Map<String, SubtopicNode> subtopics = new LinkedHashMap<>();
            for (SubtopicNode subtopic : topic.subtopics()) {
                subtopics.putIfAbsent(key(subtopic.title()), subtopic);
            }
            return new TopicDraft(topic.id(), topic.title(), topic.orderIndex(), subtopics);
        }
    }
}
