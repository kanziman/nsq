# NSQ Shadowing Web App

> 팟캐스트 기반 영어 쉐도잉 학습 웹 애플리케이션

## 프로젝트 개요

**No Stupid Questions** 팟캐스트를 활용한 화자 기반(speaker-based) 영어 쉐도잉 학습 도구.
YouTube 영상의 오디오와 자막(VTT) + 공식 트랜스크립트(텍스트)를 결합하여, 화자별로 정확하게 분리된 쉐도잉 스크립트를 생성하고, 구간 반복 재생을 지원하는 교육용 웹앱.

### 왜 NSQ인가?

- 2인 대화 구조 (Angela Duckworth & Stephen Dubner) → 화자 분리가 명확(가끔 게스트 존재)
- 공식 트랜스크립트 제공 (freakonomics.com) → 화자 레이블 + 정제된 텍스트
- 자연스러운 대화체 영어 → 쉐도잉에 최적
- 추후 다른 팟캐스트로 확장 가능한 아키텍처

---

## MVP 범위

### 입력 (Input)

| 소스           | 형식                               | 용도                             |
| -------------- | ---------------------------------- | -------------------------------- |
| YouTube URL    | `https://youtube.com/watch?v={id}` | 오디오 추출 + VTT 자막 다운로드  |
| Transcript URL | freakonomics.com 에피소드 페이지   | 화자 레이블이 포함된 공식 텍스트 |

### 처리 파이프라인 (Transcript-Guided Segmentation)

YouTube 자막(VTT)의 부정확한 텍스트 및 불분명한 문장 경계 문제를 극복하기 위해, Freakonomics 공식 대본을 정답(Ground Truth)으로 삼아 VTT의 단어별 타임스탬프를 매핑하는 파이프라인을 구축한다.

```
사용자 입력
 ├─ YouTube URL   ──→ audio.mp3 + subtitle.en.vtt (단어 타임스탬프)
 └─ 대본 URL     ──→ official-transcript.txt (정확한 텍스트 + 화자)

                     ↓

[1단계] 대본 파싱 (freakonomics.ts & transcript.ts)
        - 비발화 콘텐츠(장면 구분선, 헤더 등) 제거
        - 화자 이름 정규화 (Angela, Steven, Unknown, Moore 등) 및 문장 단위 분할

                     ↓

[2단계] 타임라인 정렬 (alignTranscript.ts)
        - patience-diff 방식 앵커링: 희소 단어로 고정 앵커 골격 확정 (LIS 최장 증가 부분수열)
        - 골격 구간 내 흔한 단어 순차 매칭 및 매칭 안 된 단어 선형 보간
        - matchRate(일치율) 0.85 미만 시 중단 및 에러 처리

                     ↓

[3단계] 최종 segments.json 생성
        - [{index, start, end, text, speaker, translation}, ...]
```

### 데이터 구조

```
.shadowing/episodes/{videoId}/
├── audio.mp3              # 오디오 파일
├── subtitle.en.vtt        # YouTube 자동생성 자막 (타임코드)
├── transcript.txt         # 공식 트랜스크립트 (화자 레이블)
├── segments.json          # 정합된 세그먼트 (최종 학습 데이터)
├── meta.json              # 에피소드 메타데이터
├── thumbnail.jpg          # 썸네일
└── import-state.json      # 파이프라인 진행 상태
```

#### segments.json 형식

```json
[
  {
    "index": 0,
    "speaker": "Angela",
    "start": 64.28,
    "end": 70.246,
    "text": "Stephen, I have a personal question for you, and I want you to be honest. Are you a hard worker?",
    "translation": "스티븐, 개인적인 질문이 있어요. 솔직하게 대답해주세요. 당신은 열심히 일하는 사람인가요?"
  }
]
```

---

## 핵심 기능 (Core Features)

### 1. 에피소드 관리 및 가져오기 (Import)

- [ ] 에피소드 목록 (임포트된 에피소드 브라우징)
- [ ] 임포트 전용 화면 (YouTube URL + Freakonomics 대본 URL 필수 입력)
- [ ] 파이프라인 단계별 진행 상태 표시 (실시간 모니터링: 다운로드 ➔ 대본 ➔ 자막 추출 ➔ 번역)
- [ ] 싱크 품질 검증 (matchRate가 0.85 미만일 시 파이프라인 자동 중단 및 에러 메시지 표시)
- [ ] 파이프라인 실패/중단 시 개별 재시도 기능 (전체 재시도, 대본만 재시도, 자막만 재시도)

### 2. 쉐도잉 플레이어

- [ ] **학습 모드 선택**: 전체 모드(전체 스크립트 흐름 학습) 및 집중 모드(세그먼트 반복 및 녹음) 전환
- [ ] **오디오 재생**: 세그먼트 단위 재생/일시정지
- [ ] **구간 반복**: 선택한 세그먼트(들) A-B 반복 재생
- [ ] **재생 경계 처리 (Boundary Back-off)**: 인접 세그먼트 간 `seg.end == next.start` 충돌 방지를 위해, 자동 정지 후 재생 시점을 경계 0.05초(50ms) 앞으로 파킹하여 부동소수점 오차 및 index 오판정 방지
- [ ] **녹음 및 재생**: 집중 모드에서 현재 세그먼트에 대고 발음 녹음 및 재생(들어보기) 기능
- [ ] **화자 필터링**: 특정 화자만 선택하여 연습
- [ ] **속도 조절**: 0.5x ~ 2.0x 재생 속도
- [ ] **자동 스크롤**: 현재 재생 중인 세그먼트로 스크롤
- [ ] **구간 선택**: 클릭/드래그로 연습할 구간 범위 지정

### 3. 스크립트 뷰

- [ ] 화자별 색상 구분 (예: Angela = 파란색, Steven = 황색/주황색)
- [ ] 현재 재생 세그먼트 하이라이트
- [ ] **번역 가독성 제어 (Blur 및 토글)**:
  - 한국어 번역은 기본적으로 블러(blur) 처리되어 표시 (마우스를 올리거나 탭하면 드러남)
  - 전체 스크립트의 번역을 한 번에 일괄 보이기/숨기기 할 수 있는 전체 토글(visible) 버튼 제공
- [ ] 단어 레벨 타임스탬프 하이라이트 (VTT word-level timing 활용)

### 4. 학습 보조

- [ ] 세그먼트별 반복 횟수 카운터
- [ ] 북마크 (어려운 구간 저장)
- [ ] 학습 진행률 표시 (전체 세그먼트 중 완료 비율)
- [ ] **단어/구문 사전 연동**: 스크립트 내 단어 클릭 시 간이 사전 팝업으로 뜻 표시

### 5. AI 튜터 피드백 (채팅)

- [ ] **우측 레이아웃 배치**: 학습 화면 우측에 AI 튜터 채팅 패널 배치
- [ ] **튜터 페르소나 선택**: Angela, Stephen, General 세 명 중 튜터를 선택해 대화 가능
  - Angela: 학술적이고 동기부여를 주는 성향 (Angela Duckworth 페르소나)
  - Stephen: 재치 있고 질문이 많으며 호기심 가득한 성향 (Stephen Dubner 페르소나)
  - General: 일반적이고 친절한 영어 작문 및 문법 피드백 제공
- [ ] **맥락 인식**: 현재 에피소드 내용이나 특정 세그먼트의 문장을 대상으로 피드백 요청 가능

---

## 기술 스택

### Frontend

- **Next.js** (App Router)
- **shadcn/ui** + Tailwind CSS (컴포넌트 라이브러리)
- **디자인 시스템**: `design-system/DESIGN.md` (Claude warm-canvas editorial 기반)
  - Warm cream canvas (#faf9f5) + coral CTA (#cc785c) + dark navy surfaces (#181715)
  - Cormorant Garamond (serif display) + Inter (sans body) + JetBrains Mono (code)
- HTML5 Audio API
- TypeScript

### Backend

- **Next.js API Routes** (Route Handlers)
- `yt-dlp`: YouTube 오디오/자막 다운로드
- LLM API (VTT + Transcript 정합 처리)

### 데이터 저장

- **파일 시스템 기반** (MVP에서는 DB 불필요)
- JSON 파일로 세그먼트, 메타데이터, 학습 상태 관리

---

## 사용자 시나리오

### 시나리오 1: 새 에피소드 임포트

```
1. 사용자가 YouTube URL + Transcript URL 입력
2. 시스템이 자동으로:
   - yt-dlp로 오디오(mp3) + 자막(vtt) 다운로드
   - 트랜스크립트 페이지에서 화자별 텍스트 스크래핑
   - LLM으로 VTT 타임코드와 트랜스크립트 화자/텍스트 정합
   - segments.json 생성
3. 에피소드 목록에 추가됨
```

### 시나리오 2: 쉐도잉 학습

```
1. 에피소드 선택 → 쉐도잉 플레이어 진입
2. 전체 스크립트가 화자별 색상으로 표시
3. 재생 버튼 클릭 → 세그먼트 단위로 재생
4. 어려운 구간에서 구간 반복 (A-B repeat)
5. 특정 화자(예: Steven만) 필터링하여 집중 연습
6. 속도를 0.7x로 낮춰서 천천히 따라 말하기
7. 번역 토글로 의미 확인
```

---

## 확장 계획 (Post-MVP)

### Phase 2: 사용자 시스템

- [ ] 사용자 인증 (로그인/회원가입)
- [ ] 개인별 학습 진행 저장
- [ ] 학습 통계 대시보드

### Phase 3: 고급 학습 기능

- [ ] 스페이스드 반복 (SRS) 기반 복습 스케줄
- [ ] 청크 기반 학습 (문장 → 구 → 단어 단위 분해)

### Phase 4: 모바일 / PWA

- [ ] PWA 지원 (오프라인 학습)
- [ ] 모바일 최적화 UI
- [ ] 오디오 백그라운드 재생

---

## 디자인 원칙

1. **학습 집중**: UI는 스크립트와 오디오 컨트롤에 집중, 불필요한 요소 최소화
2. **빠른 반복**: 구간 반복 진입/해제가 원클릭으로 가능해야 함
3. **시각적 명확성**: 화자 구분, 현재 위치, 학습 상태가 한눈에 파악 가능
4. **다크 모드 우선**: 장시간 학습에 적합한 눈 편안한 UI
5. **키보드 단축키**: 재생/정지, 구간반복, 이전/다음 세그먼트 등 핫키 지원

---

## 프로젝트 구조 (예상)

```
nsq/
├── GOAL.md                        # 이 문서
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── components.json                # shadcn/ui 설정
├── app/
│   ├── layout.tsx                 # 루트 레이아웃
│   ├── page.tsx                   # 홈 (에피소드 목록)
│   ├── import/
│   │   └── page.tsx               # 임포트 전용 화면 (진행 상태 및 재시도 제어)
│   ├── episodes/
│   │   └── [id]/
│   │       └── page.tsx           # 쉐도잉 플레이어 + AI 튜터 통합 페이지
│   └── api/
│       ├── episodes/
│       │   └── route.ts           # 에피소드 CRUD API
│       ├── import/
│       │   └── route.ts           # 임포트 파이프라인 API (재시도 파라미터 지원)
│       └── tutor/
│           └── route.ts           # AI 튜터 캐릭터별 채팅 API (LLM 연동)
├── components/
│   ├── ui/                        # shadcn/ui 컴포넌트
│   │   ├── button.tsx
│   │   ├── slider.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── player/
│   │   ├── shadowing-player.tsx   # 쉐도잉 플레이어 (전체/집중 모드 전환)
│   │   ├── audio-controls.tsx     # 오디오 컨트롤
│   │   ├── recorder.tsx           # 음성 녹음/재생 컴포넌트 (집중 모드용)
│   │   └── waveform.tsx           # 파형 시각화
│   ├── script-view.tsx            # 스크립트 뷰
│   ├── tutor-chat.tsx             # AI 튜터 우측 채팅 패널 (Angela/Stephen/General)
│   ├── episode-list.tsx           # 에피소드 목록
│   └── import-form.tsx            # 임포트 폼 및 진행/재시도 상태 제어
├── src/lib/                       # 공통 유틸 및 서비스 (src/ 디렉토리 통일)
│   ├── freakonomics.ts            # 대본 URL fetch + HTML 파싱
│   ├── transcript.ts              # 대본 텍스트 → 화자 부착 문장 분할
│   ├── alignTranscript.ts         # 문장 ↔ VTT 토큰 정합 핵심 알고리즘
│   ├── vtt.ts                     # VTT → 단어별 타임스탬프 토큰화
│   ├── youtube.ts                 # yt-dlp 기반 다운로드 서비스
│   ├── tutor.ts                   # AI 튜터 시스템 프롬프트 및 서비스
│   └── utils/
│       ├── audio.ts               # Audio API 유틸
│       ├── time.ts                # 시간 포맷 유틸
│       └── recorder.ts            # 웹 오디오 API 녹음 유틸
└── .shadowing/
    └── episodes/
        └── {videoId}/
            ├── audio.mp3
            ├── subtitle.en.vtt
            ├── transcript.txt
            ├── segments.json
            ├── meta.json
            └── import-state.json
```
