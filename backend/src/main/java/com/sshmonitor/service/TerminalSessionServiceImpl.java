package com.sshmonitor.service;

import com.sshmonitor.dto.*;
import com.sshmonitor.exception.ErrorCode;
import com.sshmonitor.exception.TerminalSessionException;
import lombok.extern.slf4j.Slf4j;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.channel.ChannelShell;
import org.apache.sshd.client.session.ClientSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.*;

@Slf4j
@Service
public class TerminalSessionServiceImpl implements TerminalSessionService {

    private final SshClient sshClient;
    private final SimpMessagingTemplate messagingTemplate;
    private final Map<String, TerminalSession> sessions = new ConcurrentHashMap<>();
    private final ExecutorService outputReaderExecutor = Executors.newCachedThreadPool();

    @Value("${terminal.max-sessions:10}")
    private int maxSessions;

    @Value("${ssh.connection-timeout:10000}")
    private int connectionTimeout;

    @Value("${ssh.session-timeout:1800000}")
    private long sessionTimeout;

    @Value("${terminal.buffer-size:8192}")
    private int bufferSize;

    public TerminalSessionServiceImpl(SshClient sshClient, SimpMessagingTemplate messagingTemplate) {
        this.sshClient = sshClient;
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public TerminalMessage connect(TerminalConnectRequest request) {
        String sessionId = request.sessionId();

        if (sessions.size() >= maxSessions) {
            log.warn("Session limit reached: {}", maxSessions);
            return TerminalMessage.error(sessionId, ErrorCode.SESSION_LIMIT.getCode(),
                "Maximum session limit (" + maxSessions + ") reached");
        }

        if (sessions.containsKey(sessionId)) {
            log.warn("Session already exists: {}", sessionId);
            return TerminalMessage.error(sessionId, ErrorCode.INVALID_REQUEST.getCode(),
                "Session already exists");
        }

        try {
            ClientSession clientSession = createClientSession(request);
            ChannelShell channel = createShellChannel(clientSession, request.terminalConfig());

            PipedOutputStream userInput = new PipedOutputStream();
            PipedInputStream channelInput = new PipedInputStream(userInput, bufferSize);
            channel.setIn(channelInput);

            PipedInputStream userOutput = new PipedInputStream(bufferSize);
            PipedOutputStream channelOutput = new PipedOutputStream(userOutput);
            channel.setOut(channelOutput);
            channel.setErr(channelOutput);

            channel.open().verify(Duration.ofMillis(connectionTimeout));

            TerminalSession terminalSession = new TerminalSession(
                sessionId,
                clientSession,
                channel,
                userInput,
                userOutput,
                Instant.now()
            );

            sessions.put(sessionId, terminalSession);
            startOutputReader(sessionId, terminalSession);

            log.info("SSH session connected: {} -> {}@{}:{}",
                sessionId, request.username(), request.host(), request.port());

            return TerminalMessage.connected(sessionId);
        } catch (Exception e) {
            log.error("Failed to connect SSH session {}: {}", sessionId, e.getMessage(), e);
            ErrorCode errorCode = determineErrorCode(e);
            return TerminalMessage.error(sessionId, errorCode.getCode(), e.getMessage());
        }
    }

    @Override
    public void handleInput(TerminalInputRequest request) {
        String sessionId = request.sessionId();
        TerminalSession session = sessions.get(sessionId);

        if (session == null) {
            log.warn("Session not found for input: {}", sessionId);
            sendError(sessionId, ErrorCode.SESSION_NOT_FOUND, "Session not found");
            return;
        }

        try {
            session.updateActivity();
            if (request.data() != null) {
                session.userInput.write(request.data().getBytes(StandardCharsets.UTF_8));
                session.userInput.flush();
            }
        } catch (IOException e) {
            log.error("Failed to send input to session {}: {}", sessionId, e.getMessage());
            sendError(sessionId, ErrorCode.NETWORK_ERROR, "Failed to send input");
        }
    }

    @Override
    public TerminalMessage disconnect(TerminalDisconnectRequest request) {
        String sessionId = request.sessionId();
        cleanupSession(sessionId);
        return TerminalMessage.disconnected(sessionId);
    }

    @Override
    public TerminalMessage resize(TerminalResizeRequest request) {
        String sessionId = request.sessionId();
        TerminalSession session = sessions.get(sessionId);

        if (session == null) {
            return TerminalMessage.error(sessionId, ErrorCode.SESSION_NOT_FOUND.getCode(), "Session not found");
        }

        try {
            session.channel.sendWindowChange(request.cols(), request.rows(), 0, 0);
            session.updateActivity();
            log.debug("Terminal resized for session {}: {}x{}", sessionId, request.cols(), request.rows());
            return TerminalMessage.resized(sessionId, request.cols(), request.rows());
        } catch (IOException e) {
            log.error("Failed to resize terminal for session {}: {}", sessionId, e.getMessage());
            return TerminalMessage.error(sessionId, ErrorCode.COMMAND_FAILED.getCode(), "Failed to resize terminal");
        }
    }

    @Override
    public void cleanupSession(String sessionId) {
        TerminalSession session = sessions.remove(sessionId);
        if (session != null) {
            session.running = false;
            closeQuietly(session.userInput);
            closeQuietly(session.userOutput);
            closeQuietly(session.channel);
            closeQuietly(session.clientSession);
            log.info("SSH session cleaned up: {}", sessionId);
        }
    }

    @Override
    public int getActiveSessionCount() {
        return sessions.size();
    }

    @Scheduled(fixedRate = 60000)
    public void cleanupExpiredSessions() {
        // 타임아웃이 0 이하면 세션 만료 비활성화 (무제한 연결)
        if (sessionTimeout <= 0) {
            return;
        }

        Instant cutoff = Instant.now().minusMillis(sessionTimeout);
        sessions.entrySet().removeIf(entry -> {
            TerminalSession session = entry.getValue();
            if (session.lastActivity.isBefore(cutoff)) {
                log.info("Cleaning up expired session: {}", entry.getKey());
                session.running = false;
                closeQuietly(session.userInput);
                closeQuietly(session.userOutput);
                closeQuietly(session.channel);
                closeQuietly(session.clientSession);
                sendStatus(entry.getKey(), "disconnected", "Session expired due to inactivity");
                return true;
            }
            return false;
        });
    }

    @Scheduled(fixedRate = 15000)
    public void healthCheckAllSessions() {
        log.trace("Running health check on {} sessions", sessions.size());
        sessions.forEach((sessionId, session) -> {
            if (!isSessionHealthy(session)) {
                log.warn("Unhealthy session detected: {}", sessionId);
                handleUnhealthySession(sessionId, session);
            }
        });
    }

    private boolean isSessionHealthy(TerminalSession session) {
        try {
            // 1. ClientSession이 열려있는지 확인
            if (!session.clientSession.isOpen()) {
                log.debug("ClientSession is closed for session");
                return false;
            }

            // 2. ChannelShell이 열려있는지 확인
            if (!session.channel.isOpen()) {
                log.debug("ChannelShell is closed for session");
                return false;
            }

            // 3. 마지막 활동 시간 확인 (60초 이상 무응답은 의심)
            // 하지만 이것만으로는 끊지 않고 위 조건들과 조합해서 판단
            return true;
        } catch (Exception e) {
            log.error("Error checking session health: {}", e.getMessage());
            return false;
        }
    }

    private void handleUnhealthySession(String sessionId, TerminalSession session) {
        cleanupSession(sessionId);
        sendStatus(sessionId, "disconnected", "Connection lost (health check failed)");
    }

    @Override
    public TerminalMessage handlePing(String sessionId) {
        log.trace("Handling ping for session: {}", sessionId);
        TerminalSession session = sessions.get(sessionId);

        if (session == null) {
            log.debug("Ping received for non-existent session: {}", sessionId);
            return TerminalMessage.pong(sessionId, false);
        }

        boolean healthy = isSessionHealthy(session);
        if (healthy) {
            session.updateActivity();
            log.trace("Ping successful for session: {}", sessionId);
        } else {
            log.warn("Ping detected unhealthy session: {}", sessionId);
        }

        return TerminalMessage.pong(sessionId, healthy);
    }

    private ClientSession createClientSession(TerminalConnectRequest request) throws Exception {
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
    }

    private ChannelShell createShellChannel(ClientSession session, TerminalConnectRequest.TerminalConfig config)
            throws IOException {
        ChannelShell channel = session.createShellChannel();
        channel.setPtyType(config.term());
        channel.setPtyColumns(config.cols());
        channel.setPtyLines(config.rows());
        return channel;
    }

    private void startOutputReader(String sessionId, TerminalSession session) {
        outputReaderExecutor.submit(() -> {
            byte[] buffer = new byte[bufferSize];
            try {
                while (session.running && !Thread.currentThread().isInterrupted()) {
                    // Blocking read - 데이터가 있을 때 즉시 반환
                    int read = session.userOutput.read(buffer);
                    if (read > 0) {
                        String output = new String(buffer, 0, read, StandardCharsets.UTF_8);
                        sendOutput(sessionId, output);
                        session.updateActivity();
                    } else if (read == -1) {
                        // Stream closed
                        break;
                    }
                }
            } catch (IOException e) {
                if (session.running) {
                    log.error("Output reader error for session {}: {}", sessionId, e.getMessage());
                    sendError(sessionId, ErrorCode.NETWORK_ERROR, "Connection lost");
                }
            } finally {
                if (session.running) {
                    cleanupSession(sessionId);
                    sendStatus(sessionId, "disconnected", "Connection closed");
                }
            }
        });
    }

    private KeyPair loadKeyPair(String privateKeyPem) throws GeneralSecurityException, IOException {
        try (java.io.ByteArrayInputStream inputStream = new java.io.ByteArrayInputStream(
                privateKeyPem.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
            Iterable<KeyPair> keyPairs = org.apache.sshd.common.util.security.SecurityUtils
                .loadKeyPairIdentities(null, null, inputStream, null);
            for (KeyPair kp : keyPairs) {
                return kp;
            }
        }
        throw new GeneralSecurityException("No valid key pair found in PEM data");
    }

    private ErrorCode determineErrorCode(Exception e) {
        String message = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
        if (message.contains("auth") || message.contains("password") || message.contains("key")) {
            return ErrorCode.AUTH_FAILED;
        }
        if (message.contains("timeout")) {
            return ErrorCode.TIMEOUT;
        }
        return ErrorCode.NETWORK_ERROR;
    }

    private void sendOutput(String sessionId, String data) {
        messagingTemplate.convertAndSend(
            "/topic/terminal/" + sessionId,
            TerminalMessage.output(sessionId, data)
        );
    }

    private void sendError(String sessionId, ErrorCode errorCode, String message) {
        messagingTemplate.convertAndSend(
            "/topic/terminal/" + sessionId,
            TerminalMessage.error(sessionId, errorCode.getCode(), message)
        );
    }

    private void sendStatus(String sessionId, String status, String message) {
        messagingTemplate.convertAndSend(
            "/topic/terminal/" + sessionId,
            TerminalMessage.status(sessionId, status, message)
        );
    }

    private void closeQuietly(Closeable closeable) {
        if (closeable != null) {
            try {
                closeable.close();
            } catch (IOException e) {
                log.debug("Error closing resource: {}", e.getMessage());
            }
        }
    }

    @Override
    public DirectoryListResponse listDirectory(DirectoryListRequest request) {
        String sessionId = request.sessionId();
        TerminalSession session = sessions.get(sessionId);

        if (session == null) {
            return DirectoryListResponse.error("Session not found");
        }

        String path = request.path();
        if (path == null || path.isEmpty()) {
            path = ".";
        }

        try {
            // ls -la 명령 실행하여 디렉토리 목록 조회
            String command = String.format("ls -la --time-style=long-iso %s 2>/dev/null || ls -la %s", path, path);
            String output = executeCommand(session.clientSession, command);

            // 실제 절대 경로 조회 (~ 등을 절대 경로로 변환)
            String currentPath = executeCommand(session.clientSession, "cd " + path + " && pwd").trim();
            log.debug("listDirectory: resolved path {} -> {}", path, currentPath);

            java.util.List<DirectoryEntry> entries = parseLsOutput(output);

            // 최상위 디렉토리(/)에서는 .. 제거
            if ("/".equals(currentPath)) {
                entries.removeIf(e -> "..".equals(e.name()));
            }

            session.updateActivity();
            session.setCurrentPath(currentPath);
            log.debug("listDirectory: saved currentPath = {}", currentPath);

            return DirectoryListResponse.success(currentPath, entries);
        } catch (Exception e) {
            log.error("Failed to list directory for session {}: {}", sessionId, e.getMessage());
            return DirectoryListResponse.error(e.getMessage());
        }
    }

    @Override
    public String getCurrentDirectory(String sessionId) {
        TerminalSession session = sessions.get(sessionId);
        if (session == null) {
            log.debug("getCurrentDirectory: session not found for {}", sessionId);
            return null;
        }

        log.debug("getCurrentDirectory: session.currentPath = {}", session.currentPath);

        // 마지막으로 탐색한 디렉토리 경로 반환
        if (session.currentPath != null) {
            log.debug("getCurrentDirectory: returning stored path {}", session.currentPath);
            return session.currentPath;
        }

        // 없으면 홈 디렉토리 반환
        try {
            String homePath = executeCommand(session.clientSession, "pwd").trim();
            session.setCurrentPath(homePath);
            log.debug("getCurrentDirectory: returning home path {}", homePath);
            return homePath;
        } catch (Exception e) {
            log.error("Failed to get current directory for session {}: {}", sessionId, e.getMessage());
            return null;
        }
    }

    private String executeCommand(ClientSession clientSession, String command) throws IOException {
        try (org.apache.sshd.client.channel.ChannelExec execChannel = clientSession.createExecChannel(command)) {
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            execChannel.setOut(outputStream);
            execChannel.setErr(outputStream);

            execChannel.open().verify(Duration.ofMillis(connectionTimeout));
            execChannel.waitFor(java.util.EnumSet.of(org.apache.sshd.client.channel.ClientChannelEvent.CLOSED), Duration.ofSeconds(10));

            return outputStream.toString(StandardCharsets.UTF_8);
        }
    }

    private java.util.List<DirectoryEntry> parseLsOutput(String output) {
        java.util.List<DirectoryEntry> entries = new java.util.ArrayList<>();
        String[] lines = output.split("\n");

        log.debug("Parsing ls output, lines count: {}", lines.length);

        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("total")) {
                continue;
            }

            // ls -la 출력 파싱 (다양한 형식 지원)
            // 형식1: drwxr-xr-x 2 user group 4096 2024-01-15 10:30 filename (--time-style=long-iso)
            // 형식2: drwxr-xr-x 2 user group 4096 Jan 15 10:30 filename (기본 형식)
            String[] parts = line.split("\\s+");
            log.debug("Line: '{}', parts count: {}", line, parts.length);

            if (parts.length < 8) {
                log.debug("Skipping line with {} parts (need at least 8)", parts.length);
                continue;
            }

            String permissions = parts[0];
            String owner = parts[2];
            String group = parts[3];
            long size = 0;
            try {
                size = Long.parseLong(parts[4]);
            } catch (NumberFormatException ignored) {}

            // 파일명은 마지막에 있음 (공백이 포함될 수 있으므로 앞부분 제거 후 추출)
            String name;
            String modified;

            // 날짜 형식에 따라 파일명 위치가 다름
            // --time-style=long-iso: drwxr-xr-x 2 user group 4096 2024-01-15 10:30 filename (9+ parts)
            // 기본 형식: drwxr-xr-x 2 user group 4096 Jan 15 10:30 filename (9+ parts)
            if (parts.length >= 9) {
                modified = parts[5] + " " + parts[6];
                // 파일명은 8번째 인덱스부터 끝까지 (공백 포함 파일명 처리)
                StringBuilder nameBuilder = new StringBuilder(parts[8]);
                for (int i = 9; i < parts.length; i++) {
                    nameBuilder.append(" ").append(parts[i]);
                }
                name = nameBuilder.toString();
            } else {
                // 8 parts: drwxr-xr-x 2 user group 4096 Jan 15 filename
                modified = parts[5] + " " + parts[6];
                name = parts[7];
            }

            // . 은 항상 제외
            if (name.equals(".")) {
                continue;
            }

            String type = "file";
            if (permissions.startsWith("d")) {
                type = "directory";
            } else if (permissions.startsWith("l")) {
                type = "link";
                // 심볼릭 링크의 경우 -> 이후 제거
                int arrowIdx = name.indexOf(" -> ");
                if (arrowIdx > 0) {
                    name = name.substring(0, arrowIdx);
                }
            }

            log.debug("Parsed entry: name={}, type={}, permissions={}", name, type, permissions);
            entries.add(new DirectoryEntry(name, type, permissions, owner, group, size, modified));
        }

        // .. 먼저, 그 다음 디렉토리, 그 다음 파일 (이름순 정렬)
        entries.sort((a, b) -> {
            // .. 은 항상 맨 위
            if (a.name().equals("..")) return -1;
            if (b.name().equals("..")) return 1;
            // 디렉토리 먼저
            if (a.type().equals("directory") && !b.type().equals("directory")) return -1;
            if (!a.type().equals("directory") && b.type().equals("directory")) return 1;
            return a.name().compareToIgnoreCase(b.name());
        });

        return entries;
    }

    private static class TerminalSession {
        final String sessionId;
        final ClientSession clientSession;
        final ChannelShell channel;
        final PipedOutputStream userInput;
        final PipedInputStream userOutput;
        final Instant createdAt;
        volatile Instant lastActivity;
        volatile boolean running = true;
        volatile String currentPath;

        TerminalSession(String sessionId, ClientSession clientSession, ChannelShell channel,
                       PipedOutputStream userInput, PipedInputStream userOutput, Instant createdAt) {
            this.sessionId = sessionId;
            this.clientSession = clientSession;
            this.channel = channel;
            this.userInput = userInput;
            this.userOutput = userOutput;
            this.createdAt = createdAt;
            this.lastActivity = createdAt;
        }

        void updateActivity() {
            this.lastActivity = Instant.now();
        }

        void setCurrentPath(String path) {
            this.currentPath = path;
        }
    }
}
