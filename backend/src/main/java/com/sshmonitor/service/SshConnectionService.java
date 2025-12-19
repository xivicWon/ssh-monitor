package com.sshmonitor.service;

import com.sshmonitor.dto.ConnectionValidationResponse;
import com.sshmonitor.dto.ServerInfoResponse;
import com.sshmonitor.dto.SshConnectionRequest;
import org.apache.sshd.client.session.ClientSession;

import java.io.IOException;

public interface SshConnectionService {

    ConnectionValidationResponse validateConnection(SshConnectionRequest request);

    ServerInfoResponse getServerInfo(SshConnectionRequest request);

    ClientSession createSession(SshConnectionRequest request) throws IOException;

    String executeCommand(ClientSession session, String command, int timeoutSeconds) throws Exception;
}
