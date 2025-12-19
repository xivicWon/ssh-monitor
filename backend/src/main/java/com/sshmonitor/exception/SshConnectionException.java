package com.sshmonitor.exception;

public class SshConnectionException extends RuntimeException {

    private final ErrorCode errorCode;

    public SshConnectionException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public SshConnectionException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public SshConnectionException(ErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
