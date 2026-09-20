package com.ay.revisor.shared;

/**
 * A resource doesn't exist, or exists but isn't owned by the requesting user.
 * Both cases must map to 404 at the controller layer, never 403 — see
 * ARCHITECTURE.md's ownership-scoping rule.
 */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }

    public static NotFoundException of(String resourceType, Object id) {
        return new NotFoundException(resourceType + " not found: " + id);
    }
}
