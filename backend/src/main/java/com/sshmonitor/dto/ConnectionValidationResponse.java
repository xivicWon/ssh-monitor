package com.sshmonitor.dto;

public record ConnectionValidationResponse(
    Boolean valid,
    String message,
    ServerInfo serverInfo,
    String errorCode
) {
    public record ServerInfo(
        String hostname,
        String osType,
        String serverTime
    ) {}

    public static ConnectionValidationResponse success(ServerInfo serverInfo) {
        return new ConnectionValidationResponse(
            true,
            "Connection successful",
            serverInfo,
            null
        );
    }

    public static ConnectionValidationResponse error(String message, String errorCode) {
        return new ConnectionValidationResponse(
            false,
            message,
            null,
            errorCode
        );
    }
}
