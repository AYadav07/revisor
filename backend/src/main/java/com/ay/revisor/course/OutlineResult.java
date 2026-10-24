package com.ay.revisor.course;

/**
 * What a bulk add did. {@code topicsMerged} counts existing topics that received outline
 * entries; {@code subtopicsSkipped} counts matches left alone, whether unchanged or skipped
 * on conflict.
 */
public record OutlineResult(int topicsCreated, int topicsMerged, int subtopicsCreated, int subtopicsUpdated,
                            int subtopicsSkipped) {
}
