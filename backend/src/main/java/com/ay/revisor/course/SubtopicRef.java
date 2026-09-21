package com.ay.revisor.course;

/** Interface projection: just enough of a Subtopic to index it, without loading notes. */
public interface SubtopicRef {

    Long getId();

    Long getTopicId();
}
