package com.sshmonitor.config;

import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.keyverifier.AcceptAllServerKeyVerifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PreDestroy;

@Configuration
public class SshClientConfig {

    private SshClient sshClient;

    @Bean
    public SshClient sshClient() {
        sshClient = SshClient.setUpDefaultClient();
        sshClient.setServerKeyVerifier(AcceptAllServerKeyVerifier.INSTANCE);
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
