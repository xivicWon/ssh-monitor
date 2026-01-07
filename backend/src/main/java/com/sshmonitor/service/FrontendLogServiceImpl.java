package com.sshmonitor.service;

import com.sshmonitor.dto.FrontendLogRequest;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class FrontendLogServiceImpl implements FrontendLogService {

    private static final Logger FRONTEND_LOGGER = LoggerFactory.getLogger("FRONTEND_CLIENT");

    @Async
    @Override
    public void saveLogs(List<FrontendLogRequest> logs) {
        if (logs == null || logs.isEmpty()) {
            log.debug("No frontend logs to save");
            return;
        }

        log.debug("Received {} frontend log(s) to save", logs.size());

        for (FrontendLogRequest logRequest : logs) {
            String logMessage = formatLogMessage(logRequest);

            switch (logRequest.level().toUpperCase()) {
                case "ERROR" -> FRONTEND_LOGGER.error(logMessage);
                case "WARN" -> FRONTEND_LOGGER.warn(logMessage);
                case "INFO" -> FRONTEND_LOGGER.info(logMessage);
                case "DEBUG" -> FRONTEND_LOGGER.debug(logMessage);
                default -> FRONTEND_LOGGER.info(logMessage);
            }
        }

        log.debug("Successfully saved {} frontend log(s)", logs.size());
    }

    /**
     * 로그 메시지 포맷: [category] [sessionId] message {data}
     */
    private String formatLogMessage(FrontendLogRequest logRequest) {
        StringBuilder sb = new StringBuilder();
        sb.append("[").append(logRequest.category()).append("]");
        sb.append(" [").append(logRequest.sessionId()).append("]");
        sb.append(" ").append(logRequest.message());

        if (logRequest.data() != null && !logRequest.data().isEmpty()) {
            sb.append(" {").append(logRequest.data()).append("}");
        }

        return sb.toString();
    }
}
