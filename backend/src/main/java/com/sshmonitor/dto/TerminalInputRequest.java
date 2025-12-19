package com.sshmonitor.dto;

import jakarta.validation.constraints.NotBlank;

public record TerminalInputRequest(
    @NotBlank
    String sessionId,

    String data
) {}
