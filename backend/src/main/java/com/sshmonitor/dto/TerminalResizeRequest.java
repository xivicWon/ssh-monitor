package com.sshmonitor.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record TerminalResizeRequest(
    @NotBlank
    String sessionId,

    @Min(1)
    Integer cols,

    @Min(1)
    Integer rows
) {}
