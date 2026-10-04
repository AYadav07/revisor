package com.ay.revisor.notification;

import org.slf4j.MDC;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.Map;

@Configuration
@EnableAsync
@EnableConfigurationProperties({NotificationProperties.class, AppMailProperties.class})
class NotificationConfig {

    static final String EXECUTOR = "notificationExecutor";

    /**
     * Deliberately tiny: email volume is a handful a day, and threads cost memory on the 1 GB VM
     * (DEPLOYMENT.md). A full queue rejects the task — the user can ask for the link again.
     * The request id is carried over, so a send's log lines tie back to the request that caused it.
     */
    @Bean(name = EXECUTOR)
    ThreadPoolTaskExecutor notificationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("notify-");
        executor.setTaskDecorator(task -> {
            Map<String, String> context = MDC.getCopyOfContextMap();
            return () -> {
                if (context != null) {
                    MDC.setContextMap(context);
                }
                try {
                    task.run();
                } finally {
                    MDC.clear();
                }
            };
        });
        return executor;
    }
}
