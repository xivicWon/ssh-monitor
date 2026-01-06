package com.sshmonitor.config;

import com.sshmonitor.service.TerminalSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final TerminalSessionService terminalSessionService;

    // WebSocket 세션 ID -> SSH 세션 ID들 매핑
    private final Map<String, Set<String>> wsSessionToSshSessions = new ConcurrentHashMap<>();

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String wsSessionId = headerAccessor.getSessionId();
        log.info("WebSocket connected: {}", wsSessionId);
        wsSessionToSshSessions.put(wsSessionId, ConcurrentHashMap.newKeySet());
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String wsSessionId = headerAccessor.getSessionId();
        log.info("WebSocket disconnected: {}", wsSessionId);

        // 해당 WebSocket 세션에 연결된 모든 SSH 세션 정리
        Set<String> sshSessions = wsSessionToSshSessions.remove(wsSessionId);
        if (sshSessions != null && !sshSessions.isEmpty()) {
            log.info("Cleaning up {} SSH sessions for WebSocket: {}", sshSessions.size(), wsSessionId);
            for (String sshSessionId : sshSessions) {
                terminalSessionService.cleanupSession(sshSessionId);
            }
        }
    }

    /**
     * SSH 세션을 WebSocket 세션에 연결
     */
    public void registerSshSession(String wsSessionId, String sshSessionId) {
        Set<String> sshSessions = wsSessionToSshSessions.get(wsSessionId);
        if (sshSessions != null) {
            sshSessions.add(sshSessionId);
            log.debug("Registered SSH session {} to WebSocket {}", sshSessionId, wsSessionId);
        }
    }

    /**
     * SSH 세션 등록 해제
     */
    public void unregisterSshSession(String wsSessionId, String sshSessionId) {
        Set<String> sshSessions = wsSessionToSshSessions.get(wsSessionId);
        if (sshSessions != null) {
            sshSessions.remove(sshSessionId);
            log.debug("Unregistered SSH session {} from WebSocket {}", sshSessionId, wsSessionId);
        }
    }

    /**
     * 활성 WebSocket 세션 수 반환
     */
    public int getActiveWebSocketCount() {
        return wsSessionToSshSessions.size();
    }
}
