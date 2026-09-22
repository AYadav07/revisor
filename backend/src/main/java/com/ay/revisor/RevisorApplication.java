package com.ay.revisor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling // RefreshTokenCleanupTask
public class RevisorApplication {

	public static void main(String[] args) {
		SpringApplication.run(RevisorApplication.class, args);
	}

}
