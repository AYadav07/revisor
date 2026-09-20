package com.ay.revisor.admin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "admin_action")
public class AdminAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_user_id")
    private Long adminUserId;

    @Column(nullable = false)
    private String action;

    @Column(name = "target_user_id")
    private Long targetUserId;

    @CreationTimestamp
    @Column(name = "timestamp", nullable = false, updatable = false)
    private Instant timestamp;

    protected AdminAction() {
    }

    public AdminAction(Long adminUserId, String action, Long targetUserId) {
        this.adminUserId = adminUserId;
        this.action = action;
        this.targetUserId = targetUserId;
    }

    public Long getId() {
        return id;
    }

    public Long getAdminUserId() {
        return adminUserId;
    }

    public String getAction() {
        return action;
    }

    public Long getTargetUserId() {
        return targetUserId;
    }

    public Instant getTimestamp() {
        return timestamp;
    }
}
