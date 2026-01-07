package com.sshmonitor.controller;

import com.sshmonitor.dto.FrontendLogRequest;
import com.sshmonitor.service.FrontendLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/frontend-logs")
@RequiredArgsConstructor
public class FrontendLogController {

    private final FrontendLogService frontendLogService;

    @PostMapping
    public ResponseEntity<Void> receiveLogs(@Valid @RequestBody List<FrontendLogRequest> logs) {
        log.debug("Received {} frontend log(s) from client", logs != null ? logs.size() : 0);

        frontendLogService.saveLogs(logs);

        return ResponseEntity.ok().build();
    }
}
