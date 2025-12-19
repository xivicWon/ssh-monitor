package com.sshmonitor.dto;

import jakarta.validation.constraints.NotBlank;

public record TerminalDisconnectRequest(
    @NotBlank
    String sessionId
) {}
