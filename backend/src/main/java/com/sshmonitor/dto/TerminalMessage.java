package com.sshmonitor.dto;

public record TerminalMessage(
    String type,
    String sessionId,
    String data,
    String status,
    String message,
    String errorCode,
    Integer cols,
    Integer rows
) {
    public static TerminalMessage connected(String sessionId) {
        return new TerminalMessage(
            "connected",
            sessionId,
            null,
            null,
            "SSH connection established",
            null,
            null,
            null
        );
    }

    public static TerminalMessage output(String sessionId, String data) {
        return new TerminalMessage(
            "output",
            sessionId,
            data,
            null,
            null,
            null,
            null,
            null
        );
    }

    public static TerminalMessage error(String sessionId, String errorCode, String message) {
        return new TerminalMessage(
            "error",
            sessionId,
            null,
            null,
            message,
            errorCode,
            null,
            null
        );
    }

    public static TerminalMessage disconnected(String sessionId) {
        return new TerminalMessage(
            "disconnected",
            sessionId,
            null,
            null,
            "SSH session closed",
            null,
            null,
            null
        );
    }

    public static TerminalMessage resized(String sessionId, Integer cols, Integer rows) {
        return new TerminalMessage(
            "resized",
            sessionId,
            null,
            null,
            null,
            null,
            cols,
            rows
        );
    }

    public static TerminalMessage status(String sessionId, String status, String message) {
        return new TerminalMessage(
            "status",
            sessionId,
            null,
            status,
            message,
            null,
            null,
            null
        );
    }

    public static TerminalMessage ping(String sessionId) {
        return new TerminalMessage(
            "ping",
            sessionId,
            null,
            null,
            null,
            null,
            null,
            null
        );
    }

    public static TerminalMessage pong(String sessionId, boolean healthy) {
        return new TerminalMessage(
            "pong",
            sessionId,
            String.valueOf(healthy),
            healthy ? "healthy" : "unhealthy",
            null,
            null,
            null,
            null
        );
    }

    public static TerminalMessage healthCheck(String sessionId, String status) {
        return new TerminalMessage(
            "health_check",
            sessionId,
            null,
            status,
            status.equals("unhealthy") ? "Session health check failed" : null,
            null,
            null,
            null
        );
    }
}
