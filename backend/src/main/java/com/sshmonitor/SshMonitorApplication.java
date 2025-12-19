package com.sshmonitor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SshMonitorApplication {

    public static void main(String[] args) {
        SpringApplication.run(SshMonitorApplication.class, args);
    }
}
