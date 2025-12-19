package com.sshmonitor.controller;

import com.sshmonitor.dto.ConnectionValidationResponse;
import com.sshmonitor.dto.ServerInfoResponse;
import com.sshmonitor.dto.SshConnectionRequest;
import com.sshmonitor.service.SshConnectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/connections")
@RequiredArgsConstructor
public class ConnectionController {

    private final SshConnectionService sshConnectionService;

    @PostMapping("/validate")
    public ResponseEntity<ConnectionValidationResponse> validateConnection(
            @Valid @RequestBody SshConnectionRequest request) {
        log.debug("Validating connection to {}@{}:{}",
            request.username(), request.host(), request.port());

        ConnectionValidationResponse response = sshConnectionService.validateConnection(request);

        if (Boolean.TRUE.equals(response.valid())) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/info")
    public ResponseEntity<ServerInfoResponse> getServerInfo(
            @Valid @RequestBody SshConnectionRequest request) {
        log.debug("Getting server info from {}@{}:{}",
            request.username(), request.host(), request.port());

        ServerInfoResponse response = sshConnectionService.getServerInfo(request);
        return ResponseEntity.ok(response);
    }
}
