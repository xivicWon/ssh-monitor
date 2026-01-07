package com.sshmonitor.service;

import com.sshmonitor.dto.*;

public interface TerminalSessionService {

    TerminalMessage connect(TerminalConnectRequest request);

    void handleInput(TerminalInputRequest request);

    TerminalMessage disconnect(TerminalDisconnectRequest request);

    TerminalMessage resize(TerminalResizeRequest request);

    void cleanupSession(String sessionId);

    int getActiveSessionCount();

    DirectoryListResponse listDirectory(DirectoryListRequest request);

    String getCurrentDirectory(String sessionId);

    TerminalMessage handlePing(String sessionId);
}
