package com.sshmonitor.controller;

import com.sshmonitor.dto.ConnectionValidationResponse;
import com.sshmonitor.exception.ErrorCode;
import com.sshmonitor.exception.SshConnectionException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(SshConnectionException.class)
    public ResponseEntity<ConnectionValidationResponse> handleSshConnectionException(
            SshConnectionException ex) {
        log.error("SSH connection error: {} - {}", ex.getErrorCode(), ex.getMessage());

        HttpStatus status = switch (ex.getErrorCode()) {
            case AUTH_FAILED, INVALID_REQUEST -> HttpStatus.BAD_REQUEST;
            case TIMEOUT -> HttpStatus.REQUEST_TIMEOUT;
            case SESSION_LIMIT -> HttpStatus.TOO_MANY_REQUESTS;
            case SESSION_EXPIRED -> HttpStatus.GONE;
            default -> HttpStatus.SERVICE_UNAVAILABLE;
        };

        return ResponseEntity
            .status(status)
            .body(ConnectionValidationResponse.error(ex.getMessage(), ex.getErrorCode().getCode()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ConnectionValidationResponse> handleValidationException(
            MethodArgumentNotValidException ex) {
        String errors = ex.getBindingResult().getFieldErrors().stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .collect(Collectors.joining(", "));

        log.warn("Validation error: {}", errors);

        return ResponseEntity
            .badRequest()
            .body(ConnectionValidationResponse.error(errors, ErrorCode.INVALID_REQUEST.getCode()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ConnectionValidationResponse> handleIllegalArgumentException(
            IllegalArgumentException ex) {
        log.warn("Invalid argument: {}", ex.getMessage());

        return ResponseEntity
            .badRequest()
            .body(ConnectionValidationResponse.error(ex.getMessage(), ErrorCode.INVALID_REQUEST.getCode()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ConnectionValidationResponse> handleGenericException(Exception ex) {
        log.error("Unexpected error: {}", ex.getMessage(), ex);

        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ConnectionValidationResponse.error(
                "An unexpected error occurred",
                ErrorCode.NETWORK_ERROR.getCode()
            ));
    }
}
