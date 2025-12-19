package com.sshmonitor.dto;

public record DirectoryEntry(
    String name,
    String type,      // "file", "directory", "link"
    String permissions,
    String owner,
    String group,
    long size,
    String modified
) {}
