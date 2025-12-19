package com.sshmonitor.dto;

public record ServerInfoResponse(
    String hostname,
    String osType,
    String osVersion,
    String uptime,
    Integer cpuCores,
    String memoryTotal,
    String diskUsage
) {}
