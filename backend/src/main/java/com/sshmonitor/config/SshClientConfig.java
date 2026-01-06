package com.sshmonitor.config;

import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.keyverifier.AcceptAllServerKeyVerifier;
import org.apache.sshd.core.CoreModuleProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PreDestroy;
import java.time.Duration;

@Configuration
public class SshClientConfig {

    private SshClient sshClient;

    @Bean
    public SshClient sshClient() {
        sshClient = SshClient.setUpDefaultClient();
        sshClient.setServerKeyVerifier(AcceptAllServerKeyVerifier.INSTANCE);

        // SSH Keepalive 설정 - 연결 유지를 위해 주기적으로 heartbeat 전송
        CoreModuleProperties.HEARTBEAT_INTERVAL.set(sshClient, Duration.ofSeconds(30));
        CoreModuleProperties.HEARTBEAT_REPLY_WAIT.set(sshClient, Duration.ofSeconds(10));

        sshClient.start();
        return sshClient;
    }

    @PreDestroy
    public void cleanup() {
        if (sshClient != null && sshClient.isStarted()) {
            sshClient.stop();
        }
    }
}
