package com.sshmonitor.exception;

public class TerminalSessionException extends RuntimeException {

    private final ErrorCode errorCode;
    private final String sessionId;

    public TerminalSessionException(ErrorCode errorCode, String sessionId) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.sessionId = sessionId;
    }

    public TerminalSessionException(ErrorCode errorCode, String sessionId, String message) {
        super(message);
        this.errorCode = errorCode;
        this.sessionId = sessionId;
    }

    public TerminalSessionException(ErrorCode errorCode, String sessionId, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
        this.sessionId = sessionId;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public String getSessionId() {
        return sessionId;
    }
}
