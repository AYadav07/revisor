package com.ay.revisor.admin;

import com.ay.revisor.auth.UserResponse;
import com.ay.revisor.auth.UserService;
import com.ay.revisor.course.CourseResponse;
import com.ay.revisor.course.CourseService;
import com.ay.revisor.dashboard.CourseProgressResponse;
import com.ay.revisor.dashboard.DashboardService;
import com.ay.revisor.shared.ConflictException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
class AdminServiceImpl implements AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminServiceImpl.class);

    private final AdminActionRepository adminActionRepository;
    private final UserService userService;
    private final CourseService courseService;
    private final DashboardService dashboardService;

    AdminServiceImpl(AdminActionRepository adminActionRepository, UserService userService,
                      CourseService courseService, DashboardService dashboardService) {
        this.adminActionRepository = adminActionRepository;
        this.userService = userService;
        this.courseService = courseService;
        this.dashboardService = dashboardService;
    }

    @Override
    public Page<UserResponse> listUsers(Long adminUserId, String query, Pageable pageable) {
        Page<UserResponse> users = userService.searchUsers(query, pageable);
        record(adminUserId, AdminActionType.LIST_USERS, null);
        return users;
    }

    @Override
    public UserResponse setUserEnabled(Long adminUserId, Long targetUserId, boolean enabled, Instant now) {
        if (!enabled && adminUserId.equals(targetUserId)) {
            throw new ConflictException("Admins cannot disable their own account");
        }
        UserResponse user = userService.setEnabled(targetUserId, enabled, now);
        record(adminUserId, enabled ? AdminActionType.ENABLE_USER : AdminActionType.DISABLE_USER, targetUserId);
        return user;
    }

    @Override
    public void deleteUser(Long adminUserId, Long targetUserId) {
        if (adminUserId.equals(targetUserId)) {
            throw new ConflictException("Admins cannot delete their own account");
        }
        userService.deleteUser(targetUserId);
        record(adminUserId, AdminActionType.DELETE_USER, targetUserId);
    }

    @Override
    public Page<UserCourseProgressResponse> listUserCourses(Long adminUserId, Long targetUserId,
                                                             Pageable pageable) {
        userService.getUser(targetUserId);

        Page<CourseResponse> courses = courseService.listCourses(targetUserId, pageable);
        Map<Long, CourseProgressResponse> progressByCourseId = dashboardService.getProgress(targetUserId).stream()
                .collect(Collectors.toMap(CourseProgressResponse::courseId, Function.identity()));

        Page<UserCourseProgressResponse> view = courses.map(course -> {
            CourseProgressResponse progress = progressByCourseId.get(course.id());
            return new UserCourseProgressResponse(course.id(), course.title(), course.description(),
                    progress == null ? 0 : progress.learnedCount(),
                    progress == null ? 0 : progress.totalCount());
        });
        record(adminUserId, AdminActionType.VIEW_USER_COURSES, targetUserId);
        return view;
    }

    /** The AdminAction table is the audit trail; the log line makes the same event visible alongside its request. */
    private void record(Long adminUserId, AdminActionType type, Long targetUserId) {
        adminActionRepository.save(new AdminAction(adminUserId, type.name(), targetUserId));
        log.info("Admin {} performed {}{}", adminUserId, type, targetUserId == null ? "" : " on user " + targetUserId);
    }
}
