package com.sshmonitor.service;

import com.sshmonitor.dto.FrontendLogRequest;
import java.util.List;

public interface FrontendLogService {
    /**
     * 프론트엔드 로그를 파일에 저장합니다.
     *
     * @param logs 저장할 로그 목록
     */
    void saveLogs(List<FrontendLogRequest> logs);
}
