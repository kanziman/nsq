# CLAUDE.md

## 프로젝트 명령어 (Build & Test Commands)

### 1. 개발 및 빌드

- 개발 서버 실행: `npm run dev`
- 프로덕션 빌드: `npm run build`
- 프로덕션 실행: `npm run start`

### 2. 코드 품질 및 검증

- 린트 검사: `npm run lint` (또는 `npx eslint .`)
- 포맷팅 검사: `npx prettier --check .`
- 포맷팅 자동 수정: `npx prettier --write .`

---

## 코드 스타일 및 팀 컨벤션 (Code Style & Team Conventions)

### 1. 네이밍 규칙 (Naming Conventions)

- **컴포넌트 및 파일명**:
  - React 컴포넌트 파일 및 폴더: `PascalCase` 사용 (예: `ShadowingPlayer.tsx`, `TutorChat.tsx`)
  - 일반 함수, 클래스, 유틸리티 파일: `camelCase` 사용 (예: `alignTranscript.ts`, `youtubeService.ts`)
- **코드 네이밍**:
  - 클래스, 타입, 인터페이스: `PascalCase` 사용 (예: `interface SegmentData`, `type ImportStep`)
  - 변수, 함수명: `camelCase` 사용 (예: `const audioUrl`, `function parseTranscript()`)
  - 상수 (전역 또는 설정 상수): `UPPER_SNAKE_CASE` 사용 (예: `const BOUNDARY_PARK_BACKOFF_SEC = 0.05`)

### 2. 코드 작성 및 설계 원칙

- **TypeScript 우선**: 모든 새로운 파일은 TypeScript(`ts`, `tsx`)로 작성하며, 타입은 최대한 명시적으로 선언합니다. (`any` 지양)
- **절대 경로 사용**: 임포트 시 상대 경로(`../..`) 대신 tsconfig에 정의된 절대 경로 별칭(`@/`)을 우선적으로 사용합니다.
- **포맷팅 규칙**: Prettier 설정(`singleQuote: true`, `semi: true`, `tabWidth: 2`)을 엄격히 준수합니다.

### 3. Git 커밋 컨벤션 (Conventional Commits)

커밋 시 반드시 아래 접두사(type)를 사용해야 하며, 커밋 메시지는 영어 소문자로 작성합니다:

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `chore`: 빌드 업무, 패키지 매니저 설정, 도구 설정 변경 등
- `docs`: 문서 수정 (README.md, CLAUDE.md 등)
- `style`: 코드 포맷팅, 세미콜론 누락 등 (코드 동작에 영향 없는 변경)
- `refactor`: 코드 리팩토링 (기능 추가나 버그 수정이 없는 구조 개선)
