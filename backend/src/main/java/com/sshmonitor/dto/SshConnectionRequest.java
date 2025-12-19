package com.sshmonitor.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record SshConnectionRequest(
    @NotBlank(message = "Host is required")
    String host,

    @Min(1)
    @Max(65535)
    Integer port,

    @NotBlank(message = "Username is required")
    String username,

    @NotBlank(message = "Auth type is required")
    String authType,

    String password,

    String privateKey
) {
    public SshConnectionRequest {
        if (port == null) {
            port = 22;
        }

        if ("password".equals(authType) && (password == null || password.isBlank())) {
            throw new IllegalArgumentException("Password is required for password authentication");
        }

        if ("privateKey".equals(authType) && (privateKey == null || privateKey.isBlank())) {
            throw new IllegalArgumentException("Private key is required for key authentication");
        }
    }
}
