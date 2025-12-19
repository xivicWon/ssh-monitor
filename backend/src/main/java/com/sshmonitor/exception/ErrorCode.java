package com.sshmonitor.exception;

public enum ErrorCode {
    AUTH_FAILED("AUTH_FAILED", "Authentication failed"),
    TIMEOUT("TIMEOUT", "Connection timeout"),
    NETWORK_ERROR("NETWORK_ERROR", "Network error"),
    SESSION_EXPIRED("SESSION_EXPIRED", "Session expired"),
    INVALID_REQUEST("INVALID_REQUEST", "Invalid request"),
    SESSION_LIMIT("SESSION_LIMIT", "Session limit exceeded"),
    COMMAND_FAILED("COMMAND_FAILED", "Command execution failed"),
    SESSION_NOT_FOUND("SESSION_NOT_FOUND", "Session not found");

    private final String code;
    private final String message;

    ErrorCode(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }
}
