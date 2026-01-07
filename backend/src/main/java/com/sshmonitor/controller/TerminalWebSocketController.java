package com.sshmonitor.controller;

import com.sshmonitor.config.WebSocketEventListener;
import com.sshmonitor.dto.*;
import com.sshmonitor.service.TerminalSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Slf4j
@Controller
@RequiredArgsConstructor
public class TerminalWebSocketController {

    private final TerminalSessionService terminalSessionService;
    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketEventListener webSocketEventListener;

    @MessageMapping("/terminal/connect")
    public void connect(TerminalConnectRequest request, SimpMessageHeaderAccessor headerAccessor) {
        log.info("Terminal connect request: {} -> {}@{}:{}",
            request.sessionId(), request.username(), request.host(), request.port());

        TerminalMessage response = terminalSessionService.connect(request);

        // SSH 세션을 WebSocket 세션에 등록
        if ("connected".equals(response.type())) {
            String wsSessionId = headerAccessor.getSessionId();
            webSocketEventListener.registerSshSession(wsSessionId, request.sessionId());
        }

        messagingTemplate.convertAndSend(
            "/topic/terminal/" + request.sessionId(),
            response
        );
    }

    @MessageMapping("/terminal/input")
    public void input(TerminalInputRequest request) {
        log.trace("Terminal input for session: {}", request.sessionId());
        terminalSessionService.handleInput(request);
    }

    @MessageMapping("/terminal/disconnect")
    public void disconnect(TerminalDisconnectRequest request, SimpMessageHeaderAccessor headerAccessor) {
        log.info("Terminal disconnect request: {}", request.sessionId());

        // SSH 세션 등록 해제
        String wsSessionId = headerAccessor.getSessionId();
        webSocketEventListener.unregisterSshSession(wsSessionId, request.sessionId());

        TerminalMessage response = terminalSessionService.disconnect(request);
        messagingTemplate.convertAndSend(
            "/topic/terminal/" + request.sessionId(),
            response
        );
    }

    @MessageMapping("/terminal/resize")
    public void resize(TerminalResizeRequest request) {
        log.debug("Terminal resize request: {} -> {}x{}",
            request.sessionId(), request.cols(), request.rows());

        TerminalMessage response = terminalSessionService.resize(request);
        messagingTemplate.convertAndSend(
            "/topic/terminal/" + request.sessionId(),
            response
        );
    }

    @MessageMapping("/terminal/listdir")
    public void listDirectory(DirectoryListRequest request) {
        log.debug("Directory list request: {} -> {}", request.sessionId(), request.path());

        DirectoryListResponse response = terminalSessionService.listDirectory(request);
        messagingTemplate.convertAndSend(
            "/topic/terminal/" + request.sessionId() + "/directory",
            response
        );
    }

    @MessageMapping("/terminal/pwd")
    public void getCurrentDirectory(String sessionId) {
        log.debug("Get current directory request: {}", sessionId);

        String path = terminalSessionService.getCurrentDirectory(sessionId);
        messagingTemplate.convertAndSend(
            "/topic/terminal/" + sessionId + "/pwd",
            path != null ? path : ""
        );
    }

    @MessageMapping("/terminal/ping")
    public void ping(String sessionId) {
        log.trace("Terminal ping request: {}", sessionId);

        TerminalMessage response = terminalSessionService.handlePing(sessionId);
        messagingTemplate.convertAndSend(
            "/topic/terminal/" + sessionId,
            response
        );
    }
}
