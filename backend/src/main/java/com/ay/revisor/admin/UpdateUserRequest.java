package com.ay.revisor.admin;

import jakarta.validation.constraints.NotNull;

public record UpdateUserRequest(@NotNull Boolean enabled) {
}
