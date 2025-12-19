package com.sshmonitor.service;

import com.sshmonitor.dto.ConnectionValidationResponse;
import com.sshmonitor.dto.ConnectionValidationResponse.ServerInfo;
import com.sshmonitor.dto.ServerInfoResponse;
import com.sshmonitor.dto.SshConnectionRequest;
import com.sshmonitor.exception.ErrorCode;
import com.sshmonitor.exception.SshConnectionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.channel.ChannelExec;
import org.apache.sshd.client.session.ClientSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.time.Duration;
import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class SshConnectionServiceImpl implements SshConnectionService {

    private final SshClient sshClient;

    @Value("${ssh.connection-timeout:10000}")
    private int connectionTimeout;

    @Value("${ssh.command-timeout:5000}")
    private int commandTimeout;

    @Override
    public ConnectionValidationResponse validateConnection(SshConnectionRequest request) {
        try (ClientSession session = createSession(request)) {
            String hostname = executeCommand(session, "hostname", commandTimeout / 1000).trim();
            String osInfo = executeCommand(session, "uname -s", commandTimeout / 1000).trim();
            String serverTime = Instant.now().toString();

            ServerInfo serverInfo = new ServerInfo(hostname, osInfo, serverTime);
            return ConnectionValidationResponse.success(serverInfo);
        } catch (SshConnectionException e) {
            return ConnectionValidationResponse.error(e.getMessage(), e.getErrorCode().getCode());
        } catch (Exception e) {
            log.error("Failed to validate connection: {}", e.getMessage(), e);
            return ConnectionValidationResponse.error(e.getMessage(), ErrorCode.NETWORK_ERROR.getCode());
        }
    }

    @Override
    public ServerInfoResponse getServerInfo(SshConnectionRequest request) {
        try (ClientSession session = createSession(request)) {
            String hostname = safeExecuteCommand(session, "hostname");
            String osType = safeExecuteCommand(session, "uname -s");
            String osVersion = safeExecuteCommand(session, "uname -r");
            String uptime = parseUptime(safeExecuteCommand(session, "uptime"));
            Integer cpuCores = parseCpuCores(safeExecuteCommand(session, "nproc"));
            String memoryTotal = parseMemory(safeExecuteCommand(session, "free -h | grep Mem | awk '{print $2}'"));
            String diskUsage = parseDiskUsage(safeExecuteCommand(session, "df -h / | tail -1 | awk '{print $5}'"));

            return new ServerInfoResponse(
                hostname,
                osType,
                osVersion,
                uptime,
                cpuCores,
                memoryTotal,
                diskUsage
            );
        } catch (SshConnectionException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to get server info: {}", e.getMessage(), e);
            throw new SshConnectionException(ErrorCode.COMMAND_FAILED, e);
        }
    }

    @Override
    public ClientSession createSession(SshConnectionRequest request) throws IOException {
        try {
            ClientSession session = sshClient.connect(
                request.username(),
                request.host(),
                request.port()
            ).verify(Duration.ofMillis(connectionTimeout)).getSession();

            if ("password".equals(request.authType())) {
                session.addPasswordIdentity(request.password());
            } else if ("privateKey".equals(request.authType())) {
                KeyPair keyPair = loadKeyPair(request.privateKey());
                session.addPublicKeyIdentity(keyPair);
            }

            session.auth().verify(Duration.ofMillis(connectionTimeout));
            return session;
        } catch (IOException e) {
            if (e.getMessage() != null && e.getMessage().contains("Auth")) {
                throw new SshConnectionException(ErrorCode.AUTH_FAILED, e);
            }
            throw new SshConnectionException(ErrorCode.NETWORK_ERROR, e);
        } catch (GeneralSecurityException e) {
            throw new SshConnectionException(ErrorCode.AUTH_FAILED, "Invalid private key format");
        } catch (Exception e) {
            if (e.getMessage() != null && e.getMessage().contains("timeout")) {
                throw new SshConnectionException(ErrorCode.TIMEOUT, e);
            }
            throw new SshConnectionException(ErrorCode.NETWORK_ERROR, e);
        }
    }

    @Override
    public String executeCommand(ClientSession session, String command, int timeoutSeconds) throws Exception {
        try (ChannelExec channel = session.createExecChannel(command);
             ByteArrayOutputStream out = new ByteArrayOutputStream();
             ByteArrayOutputStream err = new ByteArrayOutputStream()) {

            channel.setOut(out);
            channel.setErr(err);
            channel.open().verify(Duration.ofSeconds(timeoutSeconds));
            channel.waitFor(java.util.EnumSet.of(
                org.apache.sshd.client.channel.ClientChannelEvent.CLOSED
            ), Duration.ofSeconds(timeoutSeconds));

            String output = out.toString(StandardCharsets.UTF_8);
            String error = err.toString(StandardCharsets.UTF_8);

            if (!error.isEmpty()) {
                log.warn("Command '{}' produced error output: {}", command, error);
            }

            return output;
        }
    }

    private String safeExecuteCommand(ClientSession session, String command) {
        try {
            return executeCommand(session, command, commandTimeout / 1000).trim();
        } catch (Exception e) {
            log.warn("Failed to execute command '{}': {}", command, e.getMessage());
            return "N/A";
        }
    }

    private KeyPair loadKeyPair(String privateKeyPem) throws GeneralSecurityException, IOException {
        try (java.io.ByteArrayInputStream inputStream = new java.io.ByteArrayInputStream(
                privateKeyPem.getBytes(StandardCharsets.UTF_8))) {
            Iterable<KeyPair> keyPairs = org.apache.sshd.common.util.security.SecurityUtils
                .loadKeyPairIdentities(null, null, inputStream, null);
            for (KeyPair kp : keyPairs) {
                return kp;
            }
        }
        throw new GeneralSecurityException("No valid key pair found in PEM data");
    }

    private String parseUptime(String uptimeOutput) {
        if ("N/A".equals(uptimeOutput) || uptimeOutput.isEmpty()) {
            return "N/A";
        }
        int upIndex = uptimeOutput.indexOf("up");
        if (upIndex >= 0) {
            int commaIndex = uptimeOutput.indexOf(",", upIndex);
            if (commaIndex > upIndex) {
                return uptimeOutput.substring(upIndex + 3, commaIndex).trim();
            }
        }
        return uptimeOutput;
    }

    private Integer parseCpuCores(String nprocOutput) {
        if ("N/A".equals(nprocOutput) || nprocOutput.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(nprocOutput.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String parseMemory(String memoryOutput) {
        if ("N/A".equals(memoryOutput) || memoryOutput.isEmpty()) {
            return "N/A";
        }
        return memoryOutput.trim();
    }

    private String parseDiskUsage(String diskOutput) {
        if ("N/A".equals(diskOutput) || diskOutput.isEmpty()) {
            return "N/A";
        }
        return diskOutput.trim();
    }
}
