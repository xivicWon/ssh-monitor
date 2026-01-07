import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  SshConnection,
  ConnectionFormData,
  ServerInfoResponse,
  DirectoryEntry,
  TerminalSession,
  CommandHistoryItem,
  ConnectionStatus,
  SplitPane,
  SplitDirection,
} from "@/types";
import { useLogger } from "@/composables/useLogger";

const logger = useLogger();

const STORAGE_KEY = "ssh-monitor-connections";
const STATE_STORAGE_KEY = "ssh-monitor-state";
const MAX_HISTORY = 100;

// 저장할 세션 정보 (직렬화 가능한 데이터만)
interface SerializableSession {
  id: string;
  connectionId: string;
  sessionId: string;
  status: ConnectionStatus;
  currentPath: string;
}

// 저장할 전체 상태
interface PersistedState {
  layout: SplitPane;
  focusedPaneId: string | null;
  gridCols: number;
  gridRows: number;
  sessions: SerializableSession[];
  activeSessionId: string | null;
}

export const useConnectionStore = defineStore("connection", () => {
  const connections = ref<SshConnection[]>([]);
  const activeConnectionId = ref<string | null>(null);
  const serverInfo = ref<ServerInfoResponse | null>(null);
  const commandHistory = ref<CommandHistoryItem[]>([]);
  const pendingCommand = ref<string | null>(null);
  const pendingDirectoryPath = ref<string | null>(null);
  const syncToTerminalRequested = ref(false);

  // 디렉토리 관련 상태
  const currentPath = ref<string>("");
  const directoryEntries = ref<DirectoryEntry[]>([]);
  const isLoadingDirectory = ref(false);

  // 다중 세션 관리 상태
  const openSessions = ref<Map<string, TerminalSession>>(new Map());
  const activeSessionId = ref<string | null>(null);

  // 분할 레이아웃 상태
  const layout = ref<SplitPane>({
    id: "root",
    type: "terminal",
    sessionId: undefined,
  });
  const focusedPaneId = ref<string | null>("root");

  // 그리드 레이아웃 설정
  const gridCols = ref(1); // 최대 가로 개수
  const gridRows = ref(1); // 최대 세로 개수

  const activeConnection = computed(
    () =>
      connections.value.find((c) => c.id === activeConnectionId.value) || null
  );

  // 활성 세션 computed
  const activeSession = computed(() =>
    activeSessionId.value
      ? openSessions.value.get(activeSessionId.value) || null
      : null
  );

  // 세션 배열 computed (v-for용)
  const sessionsArray = computed(() => Array.from(openSessions.value.values()));

  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        connections.value = parsed;
      }
    } catch (e) {
      logger.error("Store", "Failed to load connections from storage:", e);
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections.value));
    } catch (e) {
      logger.error("Store", "Failed to save connections to storage:", e);
    }
  }

  function saveStateToStorage() {
    try {
      // 세션을 직렬화 가능한 형태로 변환
      const sessions: SerializableSession[] = Array.from(
        openSessions.value.values()
      ).map((session) => ({
        id: session.id,
        connectionId: session.connectionId,
        sessionId: session.sessionId,
        status: session.status,
        currentPath: session.currentPath,
      }));

      const state: PersistedState = {
        layout: layout.value,
        focusedPaneId: focusedPaneId.value,
        gridCols: gridCols.value,
        gridRows: gridRows.value,
        sessions,
        activeSessionId: activeSessionId.value,
      };

      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      logger.error("Store", "Failed to save state to storage:", e);
    }
  }

  function loadStateFromStorage() {
    try {
      const stored = localStorage.getItem(STATE_STORAGE_KEY);
      if (!stored) return;

      const state: PersistedState = JSON.parse(stored);

      // 레이아웃 복원
      layout.value = state.layout;
      focusedPaneId.value = state.focusedPaneId;
      gridCols.value = state.gridCols;
      gridRows.value = state.gridRows;

      // 세션 복원 (연결은 끊어진 상태로 시작)
      openSessions.value.clear();
      state.sessions.forEach((sessionData) => {
        // 연결 정보가 여전히 존재하는지 확인
        const connection = connections.value.find(
          (c) => c.id === sessionData.connectionId
        );
        if (connection) {
          const session: TerminalSession = {
            id: sessionData.id,
            connectionId: sessionData.connectionId,
            sessionId: sessionData.sessionId,
            status: "disconnected", // 새로고침 후에는 연결이 끊어진 상태
            serverInfo: null,
            commandHistory: [],
            currentPath: sessionData.currentPath,
            directoryEntries: [],
            isLoadingDirectory: false,
            autoConnect: false, // 복원된 세션은 자동 연결하지 않음
          };
          openSessions.value.set(session.id, session);
        }
      });

      activeSessionId.value = state.activeSessionId;

      logger.info("Store", "State restored from localStorage", { state });
    } catch (e) {
      logger.error("Store", "Failed to load state from storage", { error: e instanceof Error ? e.message : String(e) });
    }
  }

  function addConnection(formData: ConnectionFormData): SshConnection {
    const newConnection: SshConnection = {
      id: crypto.randomUUID(),
      name: formData.name,
      host: formData.host,
      port: formData.port,
      username: formData.username,
      authType: formData.authType,
      password:
        formData.authType === "password" ? formData.password : undefined,
      privateKey:
        formData.authType === "privateKey" ? formData.privateKey : undefined,
      createdAt: new Date().toISOString(),
    };
    connections.value.push(newConnection);
    saveToStorage();
    return newConnection;
  }

  function updateConnection(id: string, formData: Partial<ConnectionFormData>) {
    const index = connections.value.findIndex((c) => c.id === id);
    if (index !== -1) {
      connections.value[index] = {
        ...connections.value[index],
        ...formData,
      };
      saveToStorage();
    }
  }

  function removeConnection(id: string) {
    const index = connections.value.findIndex((c) => c.id === id);
    if (index !== -1) {
      connections.value.splice(index, 1);
      if (activeConnectionId.value === id) {
        activeConnectionId.value = null;
        serverInfo.value = null;
      }
      saveToStorage();
    }
  }

  function setActiveConnection(id: string | null) {
    activeConnectionId.value = id;
    if (id === null) {
      serverInfo.value = null;
    }
  }

  function updateLastConnected(id: string) {
    const connection = connections.value.find((c) => c.id === id);
    if (connection) {
      connection.lastConnectedAt = new Date().toISOString();
      saveToStorage();
    }
  }

  function setServerInfo(info: ServerInfoResponse | null) {
    serverInfo.value = info;
  }

  function getConnectionCredentials(
    id: string
  ): { password?: string; privateKey?: string } | null {
    const connection = connections.value.find((c) => c.id === id);
    if (!connection) return null;
    return {
      password: connection.password,
      privateKey: connection.privateKey,
    };
  }

  function setConnectionCredentials(
    id: string,
    password?: string,
    privateKey?: string
  ) {
    const connection = connections.value.find((c) => c.id === id);
    if (connection) {
      if (password !== undefined) connection.password = password;
      if (privateKey !== undefined) connection.privateKey = privateKey;
      saveToStorage();
    }
  }

  function clearConnectionCredentials(id: string) {
    const connection = connections.value.find((c) => c.id === id);
    if (connection) {
      connection.password = undefined;
      connection.privateKey = undefined;
      saveToStorage();
    }
  }

  function addCommand(command: string) {
    const trimmed = command.trim();
    if (!trimmed) return;

    commandHistory.value.push({
      command: trimmed,
      timestamp: new Date(),
    });

    // 최대 개수 초과시 오래된 항목 제거
    if (commandHistory.value.length > MAX_HISTORY) {
      commandHistory.value.shift();
    }
  }

  function clearHistory() {
    commandHistory.value = [];
  }

  function setPendingCommand(command: string | null) {
    pendingCommand.value = command;
  }

  function setPendingDirectoryPath(path: string | null) {
    pendingDirectoryPath.value = path;
  }

  function requestSyncToTerminal() {
    logger.debug("Store", "requestSyncToTerminal called, setting to true");
    syncToTerminalRequested.value = true;
    logger.debug("Store", "syncToTerminalRequested is now", { value: syncToTerminalRequested.value });
  }

  function clearSyncToTerminalRequest() {
    logger.debug("Store", "clearSyncToTerminalRequest called, setting to false");
    syncToTerminalRequested.value = false;
  }

  function setDirectoryData(path: string, entries: DirectoryEntry[]) {
    currentPath.value = path;
    directoryEntries.value = entries;
  }

  function setLoadingDirectory(loading: boolean) {
    isLoadingDirectory.value = loading;
  }

  function clearDirectoryData() {
    currentPath.value = "";
    directoryEntries.value = [];
  }

  // ==================== 세션 관리 함수 ====================

  function createSession(connectionId: string): TerminalSession {
    const session: TerminalSession = {
      id: crypto.randomUUID(),
      connectionId,
      sessionId: crypto.randomUUID(),
      status: "disconnected",
      serverInfo: null,
      commandHistory: [],
      currentPath: "",
      directoryEntries: [],
      isLoadingDirectory: false,
      autoConnect: true, // 새로 생성된 세션은 자동 연결
    };
    openSessions.value.set(session.id, session);
    activeSessionId.value = session.id;
    saveStateToStorage();
    return session;
  }

  function removeSession(id: string) {
    const session = openSessions.value.get(id);
    if (session) {
      openSessions.value.delete(id);
      // 활성 세션이 삭제된 경우 다른 세션으로 전환
      if (activeSessionId.value === id) {
        const remaining = Array.from(openSessions.value.keys());
        activeSessionId.value = remaining.length > 0 ? remaining[0] : null;
      }
      saveStateToStorage();
    }
  }

  function setActiveSession(id: string | null) {
    activeSessionId.value = id;
    saveStateToStorage();
  }

  function updateSessionStatus(id: string, status: ConnectionStatus) {
    const session = openSessions.value.get(id);
    if (session) {
      session.status = status;
      saveStateToStorage();
    }
  }

  function updateSessionServerInfo(
    id: string,
    info: ServerInfoResponse | null
  ) {
    const session = openSessions.value.get(id);
    if (session) {
      session.serverInfo = info;
    }
  }

  function addSessionCommand(id: string, command: string) {
    const session = openSessions.value.get(id);
    if (session) {
      const trimmed = command.trim();
      if (!trimmed) return;

      session.commandHistory.push({
        command: trimmed,
        timestamp: new Date(),
      });

      if (session.commandHistory.length > MAX_HISTORY) {
        session.commandHistory.shift();
      }
    }
  }

  function clearSessionHistory(id: string) {
    const session = openSessions.value.get(id);
    if (session) {
      session.commandHistory = [];
    }
  }

  function setSessionDirectoryData(
    id: string,
    path: string,
    entries: DirectoryEntry[]
  ) {
    const session = openSessions.value.get(id);
    if (session) {
      session.currentPath = path;
      session.directoryEntries = entries;
      saveStateToStorage();
    }
  }

  function setSessionLoadingDirectory(id: string, loading: boolean) {
    const session = openSessions.value.get(id);
    if (session) {
      session.isLoadingDirectory = loading;
    }
  }

  function getConnectionById(connectionId: string): SshConnection | null {
    return connections.value.find((c) => c.id === connectionId) || null;
  }

  // ==================== 레이아웃 관리 함수 ====================

  function findPane(pane: SplitPane, paneId: string): SplitPane | null {
    if (pane.id === paneId) return pane;
    if (pane.children) {
      for (const child of pane.children) {
        const found = findPane(child, paneId);
        if (found) return found;
      }
    }
    return null;
  }

  function findParentPane(
    pane: SplitPane,
    paneId: string,
    parent: SplitPane | null = null
  ): { parent: SplitPane; index: number } | null {
    if (pane.id === paneId) {
      return parent
        ? {
            parent,
            index: parent.children?.findIndex((c) => c.id === paneId) ?? -1,
          }
        : null;
    }
    if (pane.children) {
      for (let i = 0; i < pane.children.length; i++) {
        if (pane.children[i].id === paneId) {
          return { parent: pane, index: i };
        }
        const found = findParentPane(pane.children[i], paneId, pane);
        if (found) return found;
      }
    }
    return null;
  }

  function splitPane(
    paneId: string,
    direction: SplitDirection,
    newSessionId: string
  ) {
    const pane = findPane(layout.value, paneId);
    if (!pane) return;

    // 현재 pane을 split으로 변환
    const originalSessionId = pane.sessionId;
    const newPaneId = crypto.randomUUID();

    pane.type = "split";
    pane.direction = direction;
    pane.sessionId = undefined;
    pane.children = [
      {
        id: crypto.randomUUID(),
        type: "terminal",
        sessionId: originalSessionId,
        size: 50,
      },
      { id: newPaneId, type: "terminal", sessionId: newSessionId, size: 50 },
    ];

    // 새 pane에 포커스
    focusedPaneId.value = newPaneId;
    saveStateToStorage();
  }

  function closePane(paneId: string) {
    // 루트 pane이고 단일 터미널인 경우
    if (layout.value.id === paneId && layout.value.type === "terminal") {
      layout.value.sessionId = undefined;
      focusedPaneId.value = "root";
      saveStateToStorage();
      return;
    }

    const result = findParentPane(layout.value, paneId);
    if (!result) return;

    const { parent, index } = result;
    if (!parent.children || index === -1) return;

    // 형제 pane 찾기
    const siblingIndex = index === 0 ? 1 : 0;
    const sibling = parent.children[siblingIndex];

    // 부모를 형제로 대체
    parent.type = sibling.type;
    parent.sessionId = sibling.sessionId;
    parent.direction = sibling.direction;
    parent.children = sibling.children;
    parent.size = sibling.size;

    // 포커스 업데이트
    if (focusedPaneId.value === paneId) {
      if (parent.type === "terminal") {
        focusedPaneId.value = parent.id;
      } else if (parent.children && parent.children.length > 0) {
        // 첫 번째 터미널 pane 찾기
        const firstTerminal = findFirstTerminalPane(parent);
        focusedPaneId.value = firstTerminal?.id || parent.id;
      }
    }
    saveStateToStorage();
  }

  function findFirstTerminalPane(pane: SplitPane): SplitPane | null {
    if (pane.type === "terminal") return pane;
    if (pane.children) {
      for (const child of pane.children) {
        const found = findFirstTerminalPane(child);
        if (found) return found;
      }
    }
    return null;
  }

  function setFocusedPane(paneId: string) {
    focusedPaneId.value = paneId;
    saveStateToStorage();
  }

  function updatePaneSize(paneId: string, size: number) {
    const pane = findPane(layout.value, paneId);
    if (pane) {
      pane.size = Math.max(10, Math.min(90, size));
      saveStateToStorage();
    }
  }

  function setLayoutSessionId(paneId: string, sessionId: string | undefined) {
    const pane = findPane(layout.value, paneId);
    if (pane && pane.type === "terminal") {
      pane.sessionId = sessionId;
      saveStateToStorage();
    }
  }

  function resetLayout() {
    layout.value = { id: "root", type: "terminal", sessionId: undefined };
    focusedPaneId.value = "root";
    saveStateToStorage();
  }

  function setGridSize(cols: number, rows: number) {
    gridCols.value = Math.max(1, Math.min(4, cols));
    gridRows.value = Math.max(1, Math.min(4, rows));
    saveStateToStorage();
  }

  function reorderSessions(fromSessionId: string, toSessionId: string) {
    const sessions = Array.from(openSessions.value.entries());
    const fromIndex = sessions.findIndex(([id]) => id === fromSessionId);
    const toIndex = sessions.findIndex(([id]) => id === toSessionId);

    if (fromIndex === -1 || toIndex === -1) return;

    // 두 세션의 위치를 스위칭 (swap)
    [sessions[fromIndex], sessions[toIndex]] = [sessions[toIndex], sessions[fromIndex]];

    // Map 재구성
    openSessions.value = new Map(sessions);
    saveStateToStorage();
  }

  // 초기화: connections를 먼저 로드한 후 상태 복원
  loadFromStorage();
  loadStateFromStorage();

  return {
    // 기존 상태
    connections,
    activeConnectionId,
    activeConnection,
    serverInfo,
    commandHistory,
    pendingCommand,
    pendingDirectoryPath,
    syncToTerminalRequested,
    currentPath,
    directoryEntries,
    isLoadingDirectory,
    // 다중 세션 상태
    openSessions,
    activeSessionId,
    activeSession,
    sessionsArray,
    // 기존 함수
    addConnection,
    updateConnection,
    removeConnection,
    setActiveConnection,
    updateLastConnected,
    setServerInfo,
    getConnectionCredentials,
    setConnectionCredentials,
    clearConnectionCredentials,
    addCommand,
    clearHistory,
    setPendingCommand,
    setPendingDirectoryPath,
    requestSyncToTerminal,
    clearSyncToTerminalRequest,
    setDirectoryData,
    setLoadingDirectory,
    clearDirectoryData,
    // 세션 관리 함수
    createSession,
    removeSession,
    setActiveSession,
    updateSessionStatus,
    updateSessionServerInfo,
    addSessionCommand,
    clearSessionHistory,
    setSessionDirectoryData,
    setSessionLoadingDirectory,
    getConnectionById,
    // 레이아웃 상태
    layout,
    focusedPaneId,
    // 레이아웃 관리 함수
    splitPane,
    closePane,
    setFocusedPane,
    updatePaneSize,
    setLayoutSessionId,
    resetLayout,
    // 그리드 설정
    gridCols,
    gridRows,
    setGridSize,
    reorderSessions,
  };
});
