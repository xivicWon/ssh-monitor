# SSH Monitor

> 다중 SSH 연결 및 터미널 분할 기능을 제공하는 웹 기반 모니터링 도구

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://openjdk.java.net/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.0-green.svg)](https://spring.io/projects/spring-boot)
[![Vue](https://img.shields.io/badge/Vue-3.4.21-brightgreen.svg)](https://vuejs.org/)

## 📋 목차

- [개요](#-개요)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [빠른 시작](#-빠른-시작)
- [개발 환경 구성](#-개발-환경-구성)
- [프로젝트 구조](#-프로젝트-구조)
- [사용 방법](#-사용-방법)
- [로드맵](#-로드맵)
- [문서](#-문서)

## 🎯 개요

SSH Monitor는 웹 브라우저에서 여러 SSH 서버를 동시에 모니터링하고 관리할 수 있는 터미널 애플리케이션입니다. 최대 4개의 터미널을 동시에 분할하여 사용할 수 있으며, 각 터미널은 독립적으로 서로 다른 서버에 연결할 수 있습니다.

### 왜 SSH Monitor인가?

- **멀티 터미널**: 하나의 브라우저에서 최대 N개의 SSH 세션을 동시에 운영
- **화면 분할**: 자유도 높은 화면 분할 가능.
- **간편한 연결 관리**: SSH 연결 정보를 브라우저에 저장하고 재사용
- **보안**: 연결 정보는 클라이언트 LocalStorage에만 저장 (서버에 저장되지 않음)
- **웹 기반**: 별도 설치 없이 브라우저에서 바로 사용 가능

## ✨ 주요 기능

### 연결 관리

- ✅ SSH 연결 정보 등록 (호스트, 포트, 사용자명, 비밀번호)
- ✅ 연결 목록 조회 및 관리
- ✅ 연결 정보 수정 및 삭제
- ✅ 빠른 연결 (저장된 연결 정보로 원클릭 접속)

### 터미널 기능

- ✅ **다중 터미널**: 여러 SSH 세션 동시 운영
- ✅ **화면 분할**: 1분할 / 2분할(가로/세로) / 4분할 지원
- ✅ **동적 연결 변경**: 각 터미널에서 독립적으로 연결 전환
- ✅ **드래그 앤 드롭**: 터미널 위치 교환 (부드러운 애니메이션)
- ✅ **자동 재연결**: 터미널 위치 변경 시 자동으로 세션 재연결
- ✅ **실시간 입출력**: WebSocket 기반 실시간 터미널 통신

### UI/UX

- ✅ 반응형 레이아웃 (Left Sidebar 2 : Main Terminal 7 : Right Panel 1)
- ✅ 테마 지원 (라이트/다크 모드)
- ✅ 글로벌 명령어 전송 (모든 터미널에 동시 명령 실행)

## 🛠 기술 스택

### Frontend

| 기술       | 버전   | 용도                  |
| ---------- | ------ | --------------------- |
| Vue 3      | 3.4.21 | 프론트엔드 프레임워크 |
| TypeScript | 5.4.2  | 타입 안정성           |
| Vite       | 5.4.19 | 빌드 도구             |
| Pinia      | 2.1.7  | 상태 관리             |
| xterm.js   | 5.3.0  | 터미널 에뮬레이터     |
| STOMP.js   | 7.0.0  | WebSocket 메시징      |
| SockJS     | 1.6.1  | WebSocket fallback    |

### Backend

| 기술             | 버전   | 용도                      |
| ---------------- | ------ | ------------------------- |
| Java             | 21     | 프로그래밍 언어           |
| Spring Boot      | 3.4.0  | 백엔드 프레임워크         |
| Apache MINA SSHD | 2.13.0 | SSH 클라이언트 라이브러리 |
| WebSocket        | -      | 실시간 터미널 통신        |
| Lombok           | -      | 보일러플레이트 코드 감소  |

### Infrastructure

| 기술           | 용도                         |
| -------------- | ---------------------------- |
| Docker         | 컨테이너화                   |
| Docker Compose | 멀티 컨테이너 오케스트레이션 |
| Nginx          | 리버스 프록시                |

## 🚀 빠른 시작

### 사전 요구사항

- Docker 20.10+
- Docker Compose 2.0+

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/yourusername/ssh-monitor.git
cd ssh-monitor

# Docker Compose로 전체 서비스 시작
docker compose up -d

# 로그 확인
docker compose logs -f

# 브라우저에서 접속
# http://localhost
```

### 서비스 중지

```bash
docker compose down
```

## 💻 개발 환경 구성

### Frontend 개별 실행

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 시작 (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build

# TypeScript 타입 체크
npm run build
```

### Backend 개별 실행

```bash
cd backend

# Gradle로 실행
./gradlew bootRun

# 또는 JAR 빌드 후 실행
./gradlew build
java -jar build/libs/backend-0.0.1-SNAPSHOT.jar
```

### 개발 환경 변수

**Frontend** (`frontend/.env.development`):

```env
VITE_API_URL=/api
VITE_WS_URL=
```

**Backend** (`backend/src/main/resources/application-dev.yml`):

```yaml
server:
  port: 8080
spring:
  profiles:
    active: dev
```

## 📂 프로젝트 구조

```
ssh-monitor/
├── compose.yml              # Docker Compose 설정
├── nginx/                   # Nginx 리버스 프록시
│   ├── Dockerfile
│   └── conf.d/
│       └── default.conf
├── frontend/                # Vue 3 프로젝트
│   ├── src/
│   │   ├── components/      # Vue 컴포넌트
│   │   ├── composables/     # Vue Composables
│   │   ├── stores/          # Pinia 스토어
│   │   ├── types/           # TypeScript 타입 정의
│   │   ├── App.vue          # 루트 컴포넌트
│   │   └── main.ts          # 엔트리 포인트
│   ├── package.json
│   └── vite.config.ts
├── backend/                 # Spring Boot 프로젝트
│   └── src/main/java/com/sshmonitor/
│       ├── config/          # 설정 클래스
│       ├── controller/      # REST 컨트롤러
│       ├── service/         # 비즈니스 로직
│       ├── dto/             # 데이터 전송 객체
│       └── SshMonitorApplication.java
└── docs/                    # 문서
    ├── prod.md              # 제품 요구사항
    ├── infra.md             # 인프라 설정
    └── CLAUDE.md            # 프로젝트 설정
```

## 📖 사용 방법

### 1. SSH 연결 추가

1. 왼쪽 사이드바의 "Add Connection" 버튼 클릭
2. SSH 연결 정보 입력:

   - **Connection Name**: 연결의 별칭
   - **Host**: SSH 서버 주소
   - **Port**: SSH 포트 (기본값: 22)
   - **Username**: 사용자명
   - **Password**: 비밀번호

3. "Save" 버튼으로 저장

### 2. 터미널 연결

1. 왼쪽 사이드바에서 연결할 서버 선택
2. "Connect" 버튼 클릭
3. 터미널에서 SSH 세션 시작

### 3. 화면 분할

1. 상단 툴바에서 분할 레이아웃 선택:

   - **1분할**: 전체 화면 단일 터미널
   - **2분할(가로)**: 좌우 2개 터미널
   - **2분할(세로)**: 상하 2개 터미널
   - **4분할**: 2×2 그리드 터미널

2. 각 터미널에서 독립적으로 서버 연결 가능

### 4. 터미널 위치 교환 (드래그 앤 드롭)

1. 터미널 헤더를 드래그하여 다른 터미널 위로 이동
2. 자동으로 세션이 유지되며 위치만 교환됨
3. 부드러운 애니메이션과 함께 즉시 재연결

### 5. 글로벌 명령어

1. 상단의 "Global Command" 입력창에 명령어 입력
2. 모든 활성 터미널에 동시에 명령어 전송
3. 여러 서버에서 동일한 작업을 동시에 수행

## 🗺 로드맵

### ✅ 1차 개발: MVP (완료)

- [x] Docker Compose 환경 구성
- [x] Spring Boot + Vue 3 프로젝트 초기화
- [x] SSH 연결 API (Apache MINA SSHD)
- [x] xterm.js 터미널 연동
- [x] WebSocket 실시간 통신
- [x] 연결 관리 (추가/삭제/수정)

### ✅ 2차 개발: 멀티 터미널 (완료)

- [x] 화면 분할 (1/2/4분할)
- [x] 다중 SSH 세션 관리
- [x] 각 터미널 독립 연결 전환
- [x] 상태 정보 표시
- [x] 터미널 드래그 앤 드롭
- [x] 테마 지원 (라이트/다크)
- [x] 글로벌 명령어 기능

### 🚧 3차 개발: 고급 기능 (예정)

- [ ] 단축키 지원 (Ctrl+1~4, 포커스 이동)
- [ ] SSH 키 파일 인증
- [ ] 연결 그룹/폴더 관리
- [ ] 명령 히스토리
- [ ] 세션 로깅
- [ ] 터미널 폰트/색상 커스터마이징

### 📅 향후 계획

- [ ] SFTP 파일 전송 기능
- [ ] 터미널 세션 공유 (협업)
- [ ] 연결 정보 암호화 내보내기/가져오기
- [ ] 명령어 스니펫 저장
- [ ] 다국어 지원 (i18n)

## 📚 문서

프로젝트 관련 상세 문서는 `docs/` 디렉토리에서 확인할 수 있습니다:

- **[prod.md](docs/prod.md)**: 제품 요구사항 및 개발 로드맵
- **[infra.md](docs/infra.md)**: 인프라 및 개발 환경 설정 가이드
- **[CLAUDE.md](CLAUDE.md)**: 프로젝트 설정 및 코드 컨벤션

## 🔒 보안

- **연결 정보 보안**: SSH 연결 정보(호스트, 사용자명, 비밀번호)는 브라우저의 LocalStorage에만 저장되며, 백엔드 서버에는 저장되지 않습니다.
- **통신 보안**: WebSocket을 통한 터미널 통신은 세션별로 격리되어 있습니다.
- **향후 계획**: SSH 키 기반 인증, 연결 정보 암호화 등의 추가 보안 기능이 예정되어 있습니다.

## 🤝 기여

버그 리포트, 기능 제안, Pull Request는 언제나 환영합니다!

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙋 문의

프로젝트에 대한 질문이나 제안사항이 있으시면 이슈를 등록해 주세요.

---

**SSH Monitor** - 웹에서 만나는 강력한 SSH 터미널 🚀
