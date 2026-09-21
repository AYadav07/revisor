package com.ay.revisor.admin;

import com.ay.revisor.auth.Role;
import com.ay.revisor.auth.UserResponse;
import com.ay.revisor.auth.UserService;
import com.ay.revisor.course.CourseResponse;
import com.ay.revisor.course.CourseService;
import com.ay.revisor.dashboard.CourseProgressResponse;
import com.ay.revisor.dashboard.DashboardService;
import com.ay.revisor.shared.ConflictException;
import com.ay.revisor.shared.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminServiceImplTest {

    private static final Long ADMIN_ID = 1L;
    private static final Long TARGET_ID = 7L;
    private static final Instant NOW = Instant.parse("2026-09-22T10:00:00Z");
    private static final Pageable PAGE = PageRequest.of(0, 20);

    @Mock
    private AdminActionRepository adminActionRepository;
    @Mock
    private UserService userService;
    @Mock
    private CourseService courseService;
    @Mock
    private DashboardService dashboardService;

    private AdminServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AdminServiceImpl(adminActionRepository, userService, courseService, dashboardService);
    }

    @Test
    void listUsers_returnsUsersAndLogsActionWithNoTarget() {
        when(userService.searchUsers("ann", PAGE)).thenReturn(new PageImpl<>(List.of(userResponse(true)), PAGE, 1));

        assertThat(service.listUsers(ADMIN_ID, "ann", PAGE).getContent()).hasSize(1);

        assertLogged(AdminActionType.LIST_USERS, null);
    }

    @Test
    void setUserEnabled_false_disablesTargetAndLogsDisableUser() {
        when(userService.setEnabled(TARGET_ID, false, NOW)).thenReturn(userResponse(false));

        UserResponse response = service.setUserEnabled(ADMIN_ID, TARGET_ID, false, NOW);

        assertThat(response.enabled()).isFalse();
        assertLogged(AdminActionType.DISABLE_USER, TARGET_ID);
    }

    @Test
    void setUserEnabled_true_logsEnableUser() {
        when(userService.setEnabled(TARGET_ID, true, NOW)).thenReturn(userResponse(true));

        service.setUserEnabled(ADMIN_ID, TARGET_ID, true, NOW);

        assertLogged(AdminActionType.ENABLE_USER, TARGET_ID);
    }

    @Test
    void setUserEnabled_false_onOwnAccount_throwsConflictWithoutActingOrLogging() {
        assertThatThrownBy(() -> service.setUserEnabled(ADMIN_ID, ADMIN_ID, false, NOW))
                .isInstanceOf(ConflictException.class);

        verifyNoInteractions(userService, adminActionRepository);
    }

    @Test
    void deleteUser_deletesTargetAndLogsDeleteUserWithTargetId() {
        service.deleteUser(ADMIN_ID, TARGET_ID);

        verify(userService).deleteUser(TARGET_ID);
        assertLogged(AdminActionType.DELETE_USER, TARGET_ID);
    }

    @Test
    void deleteUser_onOwnAccount_throwsConflictWithoutActingOrLogging() {
        assertThatThrownBy(() -> service.deleteUser(ADMIN_ID, ADMIN_ID)).isInstanceOf(ConflictException.class);

        verifyNoInteractions(userService, adminActionRepository);
    }

    @Test
    void deleteUser_whenTargetStillEnabled_propagatesConflictAndLogsNothing() {
        doThrow(new ConflictException("must be disabled")).when(userService).deleteUser(TARGET_ID);

        assertThatThrownBy(() -> service.deleteUser(ADMIN_ID, TARGET_ID)).isInstanceOf(ConflictException.class);

        verify(adminActionRepository, never()).save(any());
    }

    @Test
    void listUserCourses_mergesProgressIntoCoursesAndLogsView() {
        when(userService.getUser(TARGET_ID)).thenReturn(userResponse(true));
        when(courseService.listCourses(TARGET_ID, PAGE)).thenReturn(new PageImpl<>(List.of(
                new CourseResponse(1L, "System Design", "desc"),
                new CourseResponse(2L, "Brand new", null)), PAGE, 2));
        when(dashboardService.getProgress(TARGET_ID)).thenReturn(List.of(
                new CourseProgressResponse(1L, "System Design", 3, 10)));

        List<UserCourseProgressResponse> content = service.listUserCourses(ADMIN_ID, TARGET_ID, PAGE).getContent();

        assertThat(content).containsExactly(
                new UserCourseProgressResponse(1L, "System Design", "desc", 3, 10),
                new UserCourseProgressResponse(2L, "Brand new", null, 0, 0));
        assertLogged(AdminActionType.VIEW_USER_COURSES, TARGET_ID);
    }

    @Test
    void listUserCourses_forMissingUser_propagatesNotFoundWithoutReadingCoursesOrLogging() {
        when(userService.getUser(TARGET_ID)).thenThrow(NotFoundException.of("User", TARGET_ID));

        assertThatThrownBy(() -> service.listUserCourses(ADMIN_ID, TARGET_ID, PAGE))
                .isInstanceOf(NotFoundException.class);

        verifyNoInteractions(courseService, dashboardService, adminActionRepository);
    }

    private void assertLogged(AdminActionType type, Long targetUserId) {
        ArgumentCaptor<AdminAction> captor = ArgumentCaptor.forClass(AdminAction.class);
        verify(adminActionRepository).save(captor.capture());
        assertThat(captor.getValue().getAdminUserId()).isEqualTo(ADMIN_ID);
        assertThat(captor.getValue().getAction()).isEqualTo(type.name());
        assertThat(captor.getValue().getTargetUserId()).isEqualTo(targetUserId);
    }

    private static UserResponse userResponse(boolean enabled) {
        return new UserResponse(TARGET_ID, "Ann", "ann@example.com", Role.USER, enabled, "UTC", NOW);
    }
}
