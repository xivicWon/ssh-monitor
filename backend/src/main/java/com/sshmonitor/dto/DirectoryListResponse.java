package com.sshmonitor.dto;

import java.util.List;

public record DirectoryListResponse(
    boolean success,
    String currentPath,
    List<DirectoryEntry> entries,
    String errorMessage
) {
    public static DirectoryListResponse success(String path, List<DirectoryEntry> entries) {
        return new DirectoryListResponse(true, path, entries, null);
    }

    public static DirectoryListResponse error(String message) {
        return new DirectoryListResponse(false, null, List.of(), message);
    }
}
