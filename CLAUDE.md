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
- 테스트 실행: `npm run test`

---

## 디렉토리 표준 구조 (Directory Structure)

프로젝트는 `src/` 디렉토리를 기반으로 구성되며, 관심사 분리(Separation of Concerns)를 위해 다음과 같이 폴더를 구조화합니다.

```
nsq/
├── .shadowing/              # 로컬 데이터 저장소 (오디오 mp3, 자막 vtt, 세그먼트 json 등)
├── docs/                    # 개발 및 도메인 문서
│   └── design-system/       # 디자인 시스템 가이드 (colors, typography, spacing, components)
├── scripts/                 # 개발용 스크립트 (디자인 시스템 실시간 검증 훅 등)
├── src/
│   ├── app/                 # Next.js App Router (페이지, API 라우트)
│   ├── components/          # React 컴포넌트
│   │   ├── ui/              # shadcn/ui 기본 컴포넌트
│   │   ├── player/          # 쉐도잉 플레이어 관련 컴포넌트
│   │   └── import/          # 임포트 파이프라인 관련 컴포넌트
│   ├── lib/                 # 비즈니스 로직 및 유틸리티
│   │   ├── services/        # 외부 API 및 파일 시스템 서비스 (AI 튜터, 에피소드 등)
│   │   ├── utils/           # 범용 헬퍼 함수 (오디오, 자막 파서 등)
│   │   └── types.ts         # TypeScript 공통 타입 선언
│   └── hooks/               # 커스텀 React 훅
└── package.json
```

---

## 환경 및 개발 표준 (Environment & Coding Standards)

### 1. TypeScript & 절대 경로 규칙

- **TypeScript 엄격 모드**: 모든 새로운 코드 및 설정은 TypeScript를 사용하며, `tsconfig.json` 내 `strict: true`를 필수로 유지합니다. 명시적인 타입 정의를 지향하고 `any` 타입을 지양합니다.
- **절대 경로 별칭**: 임포트 시 상대 경로(`../../components`) 대신 절대 경로 별칭 `@/`를 우선적으로 사용합니다. (예: `import Button from '@/components/ui/button'`)

### 2. 폰트 및 스타일링 기준

- **폰트 패밀리**: `Cormorant Garamond` (serif display), `Inter` (sans body), `JetBrains Mono` (code) 폰트 세트를 `next/font/google`을 활용해 루트 레이아웃에 주입하고, Tailwind CSS 설정을 연동합니다.
- **디자인 시스템 명세 준수**: [docs/design-system/DESIGN.md](file:///Users/zorba/projects/nsq/docs/design-system/DESIGN.md)와 그 세부 사양([colors.md](file:///Users/zorba/projects/nsq/docs/design-system/colors.md), [typography.md](file:///Users/zorba/projects/nsq/docs/design-system/typography.md), [spacing.md](file:///Users/zorba/projects/nsq/docs/design-system/spacing.md), [components/](file:///Users/zorba/projects/nsq/docs/design-system/components))의 맵핑을 준수합니다.
- **디자인 규격 검증 훅 (Post-use Hook)**: 파일 수정/쓰기 시 [check-design-system.js](file:///Users/zorba/projects/nsq/scripts/check-design-system.js)가 자동 실행됩니다.
  - **색상은 반드시 CSS 변수로만 사용한다 (하드코딩 금지)**
  - 스펙에 없는 임의의 spacing 픽셀값이 발견되면 경고(stderr)를 출력하므로, 자가 수정을 통해 이를 즉시 시정해야 합니다.

### 3. API 및 예외 처리 (Error Handling)

- **에러 검증 (Validation)**: 임포트 프로세스 시 공식 대본과 YouTube 자막 간의 싱크 품질 지표인 `matchRate`를 측정하여 `matchRate < 0.85`일 시 안전하게 중단하고 복구 불가능한 에러를 throw합니다.
- **오디오 경계 처리 (Boundary Back-off)**: 오디오 재생 시 세그먼트 전환 오동작 방지를 위해 `BOUNDARY_PARK_BACKOFF_SEC = 0.05`를 적용하여 경계 도달 직전 상태를 안정화합니다.
- **환경 변수**: OpenRouter API 키 및 기타 민감 정보는 `.env.local`로 격리하여 관리하고, `.env.example`을 제공합니다.

### 4. 코드 스타일 및 팀 컨벤션

- **네이밍 규칙**:
  - React 컴포넌트 파일 및 폴더: `PascalCase` 사용 (예: `ShadowingPlayer.tsx`)
  - 일반 함수, 클래스, 유틸리티 파일: `camelCase` 사용 (예: `alignTranscript.ts`)
  - 클래스, 타입, 인터페이스: `PascalCase` (예: `interface Segment`)
  - 상수 (전역 또는 설정 상수): `UPPER_SNAKE_CASE` (예: `const BOUNDARY_PARK_BACKOFF_SEC`)
- **포맷팅 규칙**: Prettier 설정(`singleQuote: true`, `semi: true`, `tabWidth: 2`)을 엄격히 준수합니다.

### 5. Git 커밋 컨벤션 (Conventional Commits)

커밋 시 반드시 아래 접두사를 사용하고 영어 소문자로 작성합니다:

- `feat`: 새로운 기능 추가 | `fix`: 버그 수정 | `refactor`: 리팩토링 | `docs`: 문서 수정 | `style`: 포맷팅 등 | `chore`: 설정 변경 등
