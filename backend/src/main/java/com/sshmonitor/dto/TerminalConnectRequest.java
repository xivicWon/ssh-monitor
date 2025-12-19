package com.sshmonitor.dto;

import jakarta.validation.constraints.NotBlank;

public record TerminalConnectRequest(
    @NotBlank
    String sessionId,

    @NotBlank
    String host,

    Integer port,

    @NotBlank
    String username,

    @NotBlank
    String authType,

    String password,

    String privateKey,

    TerminalConfig terminalConfig
) {
    public record TerminalConfig(
        Integer cols,
        Integer rows,
        String term
    ) {
        public TerminalConfig {
            if (cols == null) cols = 80;
            if (rows == null) rows = 24;
            if (term == null || term.isBlank()) term = "xterm-256color";
        }
    }

    public TerminalConnectRequest {
        if (port == null) port = 22;
        if (terminalConfig == null) terminalConfig = new TerminalConfig(80, 24, "xterm-256color");
    }
}
