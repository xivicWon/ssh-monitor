package com.sshmonitor.dto;

public record DirectoryListRequest(
    String sessionId,
    String path
) {}
