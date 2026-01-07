package com.sshmonitor.dto;

import jakarta.validation.constraints.NotBlank;

public record FrontendLogRequest(
    @NotBlank
    String timestamp,

    @NotBlank
    String level,      // DEBUG, INFO, WARN, ERROR

    @NotBlank
    String category,   // WebSocket, Ping, Terminal, Connection, etc.

    @NotBlank
    String message,

    String data,       // JSON string (optional)

    @NotBlank
    String sessionId   // 브라우저 세션 ID
) {}
