# Claude Code 프로젝트 설정

## 프로젝트 개요

SSH Monitor - 다중 SSH 연결 및 터미널 분할 기능을 제공하는 웹 기반 모니터링 도구

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Vue 3, TypeScript, Vite, Pinia, xterm.js |
| Backend | Java 21, Spring Boot 3.2.14+, Apache MINA SSHD |
| Infra | Docker, Nginx |

## 프로젝트 구조

```
ssh-monitor/
├── compose.yml           # Docker Compose 설정
├── nginx/                # Nginx 리버스 프록시
├── frontend/             # Vue 3 프로젝트
│   └── src/
│       ├── components/   # Vue 컴포넌트
│       ├── composables/  # Vue Composables
│       ├── stores/       # Pinia 스토어
│       └── types/        # TypeScript 타입
├── backend/              # Spring Boot 프로젝트
│   └── src/main/java/com/sshmonitor/
│       ├── config/       # 설정 클래스
│       ├── controller/   # REST 컨트롤러
│       ├── service/      # 비즈니스 로직
│       └── dto/          # 데이터 전송 객체
└── docs/                 # 문서
```

## 개발 명령어

```bash
# 전체 서비스 시작
docker compose up -d

# 로그 확인
docker compose logs -f

# 서비스 중지
docker compose down

# Frontend 개별 실행
cd frontend && npm run dev

# Backend 개별 실행
cd backend && ./gradlew bootRun
```

## 코드 컨벤션

### Frontend (Vue 3 / TypeScript)

- Composition API + `<script setup>` 사용
- 컴포넌트 파일명: PascalCase (예: `TerminalView.vue`)
- composables 파일명: camelCase, `use` 접두사 (예: `useSshConnection.ts`)
- 타입 정의는 `types/` 디렉토리에 분리
- Pinia 스토어명: camelCase, `use` 접두사 + `Store` 접미사 (예: `useConnectionStore`)

### Backend (Java / Spring Boot)

- 패키지 구조: `com.sshmonitor.{도메인}.{레이어}`
- 클래스명: PascalCase
- 메서드/변수명: camelCase
- 상수: UPPER_SNAKE_CASE
- DTO 클래스는 record 사용 권장
- Lombok 어노테이션 활용 (`@Data`, `@Builder`, `@RequiredArgsConstructor`)

## API 규칙

- Base URL: `/api`
- WebSocket: `/ws`
- REST 엔드포인트: 복수형 명사 사용 (예: `/api/connections`)
- HTTP 메서드: GET(조회), POST(생성), PUT(수정), DELETE(삭제)

## 주의사항

1. **SSH 연결 정보**: 클라이언트 LocalStorage에만 저장, 서버에 저장 금지
2. **WebSocket**: SSH 터미널 통신은 반드시 WebSocket 사용
3. **Docker 네트워크**: 서비스 간 통신은 서비스명 사용 (예: `backend:8080`)
4. **CORS**: Nginx가 프록시하므로 별도 CORS 설정 불필요

## 문서 작성 규칙

- **기본 길이**: 모든 문서는 500줄 미만으로 작성
- **최대 길이**: 불가피한 경우에도 800줄 미만 유지
- 문서가 길어질 경우 파일을 분리하여 관리

## 참고 문서

- [prod.md](./prod.md) - 제품 요구사항 및 개발 로드맵
- [infra.md](./infra.md) - 개발 환경 및 인프라 설정
