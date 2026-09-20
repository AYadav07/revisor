package com.ay.revisor.shared;

/**
 * The request is well-formed and the resource exists and is owned by the caller, but
 * the current state doesn't allow the operation — e.g. reviewing a subtopic with no
 * LearningRecord yet (ARCHITECTURE.md §6), or deleting a user who isn't disabled yet
 * (ARCHITECTURE.md §7). Maps to 409 at the controller layer.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
