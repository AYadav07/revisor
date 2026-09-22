package com.ay.revisor.admin;

import com.ay.revisor.auth.Role;
import com.ay.revisor.auth.User;
import com.ay.revisor.auth.UserRepository;
import com.ay.revisor.support.PostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The exact real-Postgres behavior the V2 migration was written for: an admin_action row must
 * outlive the user rows it references. This is the one guarantee that only running against real
 * Postgres (not H2, not mocks) can actually prove — dropping the wrong constraint would only ever
 * surface here.
 */
class AdminActionRepositoryPostgresTest extends PostgresIntegrationTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private AdminActionRepository adminActionRepository;

    @AfterEach
    void cleanUp() {
        adminActionRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void auditRow_survivesWithBothUserIdsIntact_afterBothTheAdminAndTheTargetAreDeleted() {
        Long adminId = userRepository.save(new User("Admin", "admin@example.com", "hash", Role.ADMIN, true, "UTC")).getId();
        Long targetId = userRepository.save(new User("Bob", "bob@example.com", "hash", Role.USER, false, "UTC")).getId();
        Long actionId = adminActionRepository.save(new AdminAction(adminId, "DELETE_USER", targetId)).getId();

        userRepository.deleteById(targetId);
        userRepository.deleteById(adminId);

        AdminAction reloaded = adminActionRepository.findById(actionId).orElseThrow();
        assertThat(reloaded.getAdminUserId()).isEqualTo(adminId);
        assertThat(reloaded.getTargetUserId()).isEqualTo(targetId);
    }
}
