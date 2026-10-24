package com.ay.revisor.shared;

import java.util.List;

/**
 * Validation that Bean Validation annotations can't express (e.g. rules spanning several
 * list entries), reported in the same {@code validation-failed} shape as annotation errors:
 * one entry per offending field path, such as {@code topics[2].subtopics[0].title}.
 */
public class InvalidFieldsException extends RuntimeException {

    public record FieldProblem(String field, String message) {
    }

    private final List<FieldProblem> problems;

    public InvalidFieldsException(List<FieldProblem> problems) {
        super("One or more fields are invalid");
        this.problems = List.copyOf(problems);
    }

    public List<FieldProblem> getProblems() {
        return problems;
    }
}
