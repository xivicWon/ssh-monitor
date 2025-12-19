# SSH Monitor - 개발 환경 정의서

---

## 1. 프로젝트 구조

```
ssh-monitor/
├── compose.yml                 # 개발 환경 오케스트레이션
├── compose.prod.yml            # 운영 환경 설정
│
├── nginx/                      # Nginx 리버스 프록시
│   ├── Dockerfile
│   ├── nginx.conf              # 메인 설정
│   ├── conf.d/
│   │   ├── default.conf        # 개발용 설정
│   │   └── prod.conf           # 운영용 설정
│   └── ssl/                    # SSL 인증서 (운영)
│       ├── cert.pem
│       └── key.pem
│
├── frontend/                   # Vue 3 프로젝트
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       ├── components/
│       │   ├── layout/
│       │   │   ├── LeftSidebar.vue
│       │   │   ├── MainTerminal.vue
│       │   │   └── RightPanel.vue
│       │   └── terminal/
│       │       └── TerminalView.vue
│       ├── composables/
│       ├── stores/
│       └── types/
│
├── backend/                    # Spring Boot 프로젝트
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── build.gradle
│   ├── settings.gradle
│   └── src/
│       └── main/
│           ├── java/
│           │   └── com/sshmonitor/
│           │       ├── SshMonitorApplication.java
│           │       ├── config/
│           │       │   └── WebSocketConfig.java
│           │       ├── controller/
│           │       │   └── SshController.java
│           │       ├── service/
│           │       │   └── SshService.java
│           │       └── dto/
│           └── resources/
│               └── application.yml
│
└── docs/                       # 문서
    ├── prod.md
    └── infra.md
```

---

## 2. 기술 스택 상세

### 2.1 Frontend

| 항목 | 버전 | 용도 |
|------|------|------|
| Node.js | 20 LTS | 런타임 |
| Vue | 3.4+ | UI 프레임워크 |
| TypeScript | 5.x | 타입 안정성 |
| Vite | 5.4.19+ | 빌드 도구 |
| Pinia | 2.x | 상태 관리 |
| xterm.js | 5.x | 웹 터미널 |
| xterm-addon-fit | 0.8+ | 터미널 크기 자동 조절 |
| xterm-addon-attach | 0.9+ | WebSocket 연결 |

### 2.2 Backend

| 항목 | 버전 | 용도 |
|------|------|------|
| Java | 21 LTS | 런타임 |
| Spring Boot | 3.2.14+ | 웹 프레임워크 |
| Spring WebSocket | - | 실시간 통신 |
| Apache MINA SSHD | 2.x | SSH 클라이언트 |
| Lombok | - | 보일러플레이트 제거 |
| Gradle | 8.x | 빌드 도구 |

### 2.3 Infrastructure

| 항목 | 버전 | 용도 |
|------|------|------|
| Docker | 24+ | 컨테이너화 |
| Docker Compose v2 | (Docker 내장) | 멀티 컨테이너 관리 |
| Nginx | 1.27+ | 리버스 프록시 (개발/운영) |

---

## 3. Docker 설정

### 3.1 compose.yml (개발용)

```yaml
services:
  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    expose:
      - "5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost/api
      - VITE_WS_URL=ws://localhost/ws

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    expose:
      - "8080"
    volumes:
      - ./backend:/app
    environment:
      - SPRING_PROFILES_ACTIVE=dev
```

### 3.2 Frontend Dockerfile.dev

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### 3.3 Backend Dockerfile.dev

```dockerfile
FROM eclipse-temurin:21-jdk

WORKDIR /app

COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .

RUN ./gradlew dependencies --no-daemon

COPY src src

EXPOSE 8080

CMD ["./gradlew", "bootRun", "--no-daemon"]
```

### 3.4 Nginx Dockerfile

```dockerfile
FROM nginx:1.27-alpine

# 기본 설정 제거
RUN rm /etc/nginx/conf.d/default.conf

# 커스텀 설정 복사
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
```

### 3.5 Nginx 설정 파일

**nginx/nginx.conf** (메인 설정)
```nginx
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    keepalive_timeout  65;

    # WebSocket 타임아웃 설정
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;

    include /etc/nginx/conf.d/*.conf;
}
```

**nginx/conf.d/default.conf** (개발용)
```nginx
upstream frontend {
    server frontend:5173;
}

upstream backend {
    server backend:8080;
}

server {
    listen 80;
    server_name localhost;

    # Frontend (Vite Dev Server)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Vite HMR WebSocket
    location /@vite/ {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend WebSocket (SSH 터미널)
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }
}
```

**nginx/conf.d/prod.conf** (운영용)
```nginx
upstream backend {
    server backend:8080;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Frontend Static Files
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend WebSocket
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }
}
```

---

## 4. 개발 환경 설정

### 4.1 필수 설치 항목

```bash
# macOS
brew install node@20
brew install openjdk@21

# Docker Desktop 설치 (docker compose v2 포함)
# https://www.docker.com/products/docker-desktop
```

### 4.2 IDE 권장 설정

**VSCode / Cursor Extensions:**
- Vue - Official (Vue.volar)
- TypeScript Vue Plugin
- ESLint
- Prettier

**IntelliJ IDEA (Backend):**
- Lombok Plugin
- Spring Boot Assistant

### 4.3 Git Hooks (선택)

```bash
# .husky/pre-commit
npm run lint --prefix frontend
./backend/gradlew check
```

---

## 5. 실행 방법

### 5.1 Docker Compose (권장)

```bash
# 전체 서비스 시작
docker compose up -d

# 로그 확인
docker compose logs -f

# 중지
docker compose down
```

### 5.2 개별 실행 (로컬 개발)

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend (별도 터미널)
cd backend
./gradlew bootRun
```

---

## 6. 포트 구성

| 서비스 | 내부 포트 | 외부 노출 | 설명 |
|--------|----------|----------|------|
| Nginx | 80/443 | **80** (진입점) | 리버스 프록시 |
| Frontend (Vite) | 5173 | - (내부) | 개발 서버 |
| Backend (Spring) | 8080 | - (내부) | API / WebSocket |

### 아키텍처

```
[개발 환경]
                    ┌─────────────────────────────────────┐
                    │           Docker Network            │
                    │                                     │
Browser ──:80──▶ [Nginx] ──/──────▶ [Frontend:5173]     │
                    │      ──/api/──▶ [Backend:8080]      │
                    │      ──/ws────▶ [Backend:8080]      │
                    └─────────────────────────────────────┘

[운영 환경]
                    ┌─────────────────────────────────────┐
                    │           Docker Network            │
                    │                                     │
Browser ──:443─▶ [Nginx] ──/──────▶ [Static Files]      │
                    │      ──/api/──▶ [Backend:8080]      │
                    │      ──/ws────▶ [Backend:8080]      │
                    └─────────────────────────────────────┘
```

### URL 매핑

| 경로 | 라우팅 대상 | 용도 |
|------|------------|------|
| `/` | Frontend (Vite / Static) | SPA 메인 |
| `/@vite/*` | Frontend | HMR (개발 전용) |
| `/api/*` | Backend | REST API |
| `/ws` | Backend | WebSocket (SSH) |

---

## 7. 환경 변수

### 7.1 Frontend (.env)

```env
# 개발 환경 (Nginx 경유)
VITE_API_URL=http://localhost/api
VITE_WS_URL=ws://localhost/ws
```

### 7.2 Backend (application.yml)

```yaml
server:
  port: 8080

spring:
  profiles:
    active: dev

ssh:
  connection-timeout: 30000
  channel-timeout: 30000

logging:
  level:
    com.sshmonitor: DEBUG
```

---

## 8. 개발 워크플로우

```
1. 기능 브랜치 생성
   git checkout -b feature/xxx

2. Docker 환경 실행
   docker compose up -d

3. 코드 작성 (Hot Reload 지원)
   - Frontend: Vite HMR
   - Backend: Spring DevTools

4. 테스트
   npm run test --prefix frontend
   ./backend/gradlew test

5. PR 생성 및 리뷰
```

---

## 9. 체크리스트

### 1차 개발 환경 구성 완료 기준

- [ ] Docker Compose로 nginx/frontend/backend 동시 실행
- [ ] Nginx 리버스 프록시 정상 동작 (localhost:80 접속)
- [ ] Frontend에서 Backend API 호출 성공 (/api/*)
- [ ] WebSocket 연결 테스트 통과 (/ws)
- [ ] Vite HMR 정상 동작 (코드 수정 시 자동 반영)
- [ ] Backend Hot Reload 정상 동작
