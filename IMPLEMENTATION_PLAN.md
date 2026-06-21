# NSQ Shadowing Web App Implementation Plan (최종)

Next.js App Router, shadcn/ui, Tailwind CSS를 기반으로 한 팟캐스트(No Stupid Questions) 영어 쉐도잉 학습 웹 애플리케이션의 상세 설계서.
공식 대본 기반 정합 파이프라인(Transcript-Guided Segmentation), 전체/집중 학습 모드, 녹음 기능, 무료 사전 연동 및 OpenRouter 기반 AI 튜터 채팅의 최종 구조를 정리합니다.

---

## 확정된 기술 의사결정 (Decisions)

### 1. LLM API 연동 (OpenRouter)

- **제공 서비스**: OpenRouter API
- **환경 변수**:
  - `OPENROUTER_API_KEY`: OpenRouter API 호출용 인증 키
  - `TRANSLATION_MODEL=google/gemini-2.5-pro`: 번역 및 AI 튜터 추론 모델로 사용
- **용도**:
  - 세그먼트 번역 단계 (`app/api/import/route.ts` ➔ LLM 번역 모델)
  - AI 튜터 캐릭터별 채팅 (`app/api/tutor/route.ts` ➔ 캐릭터 페르소나 주입 대화)

### 2. AI 튜터 대화 이력 관리

- **저장 위치**: 브라우저 클라이언트 세션 저장소 (`sessionStorage`)
- **수명**: 사용자가 브라우저 탭을 열고 학습하는 동안 유지되며, 탭을 닫으면 이력이 정돈되어 소멸하도록 설계.

### 3. 사전 연동

- **대상 API**: 무료 오픈 사전 API (Free Dictionary API)
  - 엔드포인트: `https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
- **동작**: 스크립트 뷰에서 단어 클릭 시 비동기로 API 호출 후 의미, 발음(Audio 주소 포함 시 재생 가능) 등을 카드 팝업에 노출.

---

## 시스템 환경 및 의존성

> [!IMPORTANT]
> **서버 의존성 (yt-dlp)**
>
> - 유튜브 오디오 다운로드 및 자막(vtt) 다운로드를 수행하기 위해 서버를 실행할 로컬 OS 환경에 `yt-dlp` 및 `ffmpeg` 실행 파일이 반드시 전역 환경 변수에 노출되어 있어야 합니다.

---

## Proposed Changes & File Structure

사용자 본인이 직접 구현할 수 있도록 각 레이어별 수정/생성해야 할 상세 명세를 아래와 같이 구조화합니다.

### 1. Project Setup & Styling Tokens

Next.js App Router 프로젝트 부트스트랩 및 `design-system/DESIGN.md`에서 제시한 따뜻한 에디토리얼 테마(warm-canvas) 적용 설정.

#### [NEW] [package.json](file:///Users/zorba/projects/nsq/package.json)

- React, Next.js, lucide-react, OpenRouter API 통신용 fetch/sdk 의존성 추가.

#### [NEW] [tailwind.config.ts](file:///Users/zorba/projects/nsq/tailwind.config.ts)

- `design-system/DESIGN.md` 사양(cream canvas `#faf9f5`, coral CTA `#cc785c`, dark navy surfaces `#181715` 등)을 커스텀 CSS 변수로 로드하도록 테마 확장.

#### [NEW] [app/globals.css](file:///Users/zorba/projects/nsq/app/globals.css)

- `Copernicus`, `Inter`, `JetBrains Mono` 서체 구성 요소 선언 및 CSS 변수 추가. shadcn/ui 기본 스타일을 warm-canvas 테마 변수로 오버라이드.

#### [NEW] [components.json](file:///Users/zorba/projects/nsq/components.json)

- shadcn/ui 초기 설정.

#### [NEW] [app/layout.tsx](file:///Users/zorba/projects/nsq/app/layout.tsx)

- Google Fonts (`next/font/google` 사용)로 Cormorant Garamond, Inter, JetBrains Mono를 지정하고 루트 body 태그에 폰트 클래스 및 배경색(`bg-canvas`) 주입.

---

### 2. Alignment Aligner Core (src/lib/)

공식 대본의 정교한 텍스트를 기준으로 VTT 자막 파일의 타임코드를 바인딩하는 무결성 정합 엔진 구축.

#### [NEW] [src/lib/types.ts](file:///Users/zorba/projects/nsq/src/lib/types.ts)

- `Episode`, `Segment`, `VttToken`, `Sentence`, `ImportState` 등 데이터 구조 타입 정의.

#### [NEW] [src/lib/freakonomics.ts](file:///Users/zorba/projects/nsq/src/lib/freakonomics.ts)

- 사용자가 입력한 Freakonomics 공식 대본 URL을 바탕으로 HTML을 fetch하고, 대본 본문(`* * *` 구분선 이후 내용)만 순수 텍스트로 추출.

#### [NEW] [src/lib/transcript.ts](file:///Users/zorba/projects/nsq/src/lib/transcript.ts)

- 대본 텍스트의 불필요한 메타 라벨 제거.
- `DUCKWORTH:` ➔ `Angela`, `DUBNER:` ➔ `Steven`, `MOORE:` ➔ `Moore` 형식으로 화자 라벨 파싱 및 화자 이름 정규화.
- 온점(`.`, `?`, `!`) 기준 문장 단위 분할. 40단어가 넘어가는 긴 문장은 쉼표(`,`) 단위로 2차 분할 지원.

#### [NEW] [src/lib/vtt.ts](file:///Users/zorba/projects/nsq/src/lib/vtt.ts)

- YouTube 자동생성 VTT 자막 파싱. 자막 내 단어 레벨 태그(예: `<c>`) 및 타임스탬프를 매칭하여 `word`와 `time` 구조의 1차원 `VttToken` 배열로 전환.

#### [NEW] [src/lib/alignTranscript.ts](file:///Users/zorba/projects/nsq/src/lib/alignTranscript.ts)

- **Patience-Diff 앵커 매칭 알고리즘**:
  1. 대본 문장 단어 배열과 VTT 토큰 배열 양측에서 유일하게 딱 **1번만** 등장하는 희소 단어들을 교집합으로 묶어 앵커 후보 구성.
  2. LIS(최장 증가 부분수열)을 통해 인덱스와 시간이 순서대로 단조 증가하는 보장된 앵커 골격 확정.
  3. 확정된 골격 앵커 구간 내부에서 흔한 단어들을 시간순 매핑.
  4. 매칭되지 않은 단어들은 앞뒤 앵커의 시간 정보를 바탕으로 선형 보간(Linear Interpolation)하여 시간 할당.
- **싱크 품질 지표 검증**:
  - `matchRate` (앵커 매칭 단어 수 / 대본 전체 단어 수) 계산.
  - `matchRate < 0.85` 인 경우 잘못된 대본 URL로 판단하여 파이프라인 중단 및 에러를 throw.

#### [NEW] [src/lib/youtube.ts](file:///Users/zorba/projects/nsq/src/lib/youtube.ts)

- 내부적으로 `yt-dlp` 및 `ffmpeg` 프로세스를 실행하여 오디오 파일(`audio.mp3`) 및 자동 생성 영어 자막(`subtitle.en.vtt`) 다운로드.

---

### 3. Import Pipeline API & Page

가져오기 프로세스의 상태 추적 및 단계별 재실행 제어.

#### [NEW] [app/api/import/route.ts](file:///Users/zorba/projects/nsq/app/api/import/route.ts)

- 가져오기 실행 POST API.
- 요청 본문 파라미터로 `retryStep: "all" | "transcript" | "subtitles"`를 지원하여, 로컬 세션 또는 `.shadowing/episodes/{videoId}/import-state.json`에 저장된 상태를 기준으로 실패한 중간 지점부터 재수행 지원.
- `alignTranscript` 호출 후 `matchRate < 0.85` 인 경우 상태를 실패로 변경 후 에러 리턴.
- `TRANSLATION_MODEL=google/gemini-2.5-pro` 환경 변수에 지정된 모델로 OpenRouter API를 호출하여 segments의 영어 텍스트를 한국어 번역으로 채워넣는 프로세스 연동.

#### [NEW] [app/import/page.tsx](file:///Users/zorba/projects/nsq/app/import/page.tsx)

- 단독 임포트 화면. YouTube URL 및 Freakonomics 대본 URL 입력 필드 탑재 (둘 다 필수).
- 진행 상태(다운로드 ➔ 대본 ➔ 자막 추출 ➔ 번역)를 단계별 인디케이터로 노출.
- 실패 상황 시 `재시도` 버튼 활성화.

#### [NEW] [components/import-form.tsx](file:///Users/zorba/projects/nsq/components/import-form.tsx)

- 디자인 시스템에 정의된 입력 필드 스타일(cream bg, hairline border, coral focus ring)이 가미된 폼 UI.

---

### 4. Player & Study Interface (with Tutor Chat & Focus Mode)

플레이어 페이지 2열 레이아웃 배치, 재생 제어, 무료 사전 팝업 및 AI 튜터 연동.

#### [NEW] [app/page.tsx](file:///Users/zorba/projects/nsq/app/page.tsx)

- 홈 화면: 로컬 `.shadowing/episodes/` 파일들을 읽어 렌더링하는 에피소드 카드 그리드. 우측 상단 또는 헤더 영역에 "새 에피소드 가져오기" 버튼 배치.

#### [NEW] [app/episodes/\[id\]/page.tsx](file:///Users/zorba/projects/nsq/app/episodes/[id]/page.tsx)

- 학습 메인 화면. 좌측 70%(플레이어 + 스크립트 뷰), 우측 30%(AI 튜터 채팅 패널)로 구분된 에디토리얼 레이아웃.
- **재생 경계 처리(Boundary Back-off)**:
  - 브라우저 오디오 재생 `timeupdate` 이벤트 리스너 내장.
  - 재생 시 인접한 세그먼트 간 끝 시간과 시작 시간이 맞닿을 때 발생하는 오동작 및 부동소수점 오차에 대응하기 위해, 세그먼트 자동 일시정지 후 다음 재생 지점을 경계에서 `BOUNDARY_PARK_BACKOFF_SEC = 0.05` (50ms) 만큼 이전 시점으로 후퇴하여 파킹(park)시키는 로직 구현.

#### [NEW] [components/player/shadowing-player.tsx](file:///Users/zorba/projects/nsq/components/player/shadowing-player.tsx)

- `전체 모드`(스크립트 순차 재생) 및 `집중 모드`(구간 반복 재생 및 녹음 컨트롤 노출) 제어 토글 스위치 제공.
- 화자 필터링(Angela만, Steven만, 전체) 체크박스 및 재생 배속 조절 바.

#### [NEW] [components/player/recorder.tsx](file:///Users/zorba/projects/nsq/components/player/recorder.tsx)

- 집중 모드 활성화 시 표시되는 발음 녹음기.
- 마이크 권한 요청, 녹음 상태 표시, 녹음 정지 후 내 목소리 재생 버튼 제공.

#### [NEW] [lib/utils/recorder.ts](file:///Users/zorba/projects/nsq/lib/utils/recorder.ts)

- HTML5 MediaRecorder API를 래핑하여 오디오 트랙을 입력받아 Blob 객체 생성 헬퍼.

#### [NEW] [components/script-view.tsx](file:///Users/zorba/projects/nsq/components/script-view.tsx)

- 스크립트 텍스트 렌더러. 화자 이름에 부합하는 컬러 할당.
- 한국어 번역 가독성 제어:
  - 개별 번역은 기본적으로 CSS `blur(4px)` 필터 처리. 마우스 호버(hover) 또는 클릭/탭 시 필터를 `blur(0)`으로 초기화하여 노출.
  - 상단에 "전체 번역 보이기/숨기기" 글로벌 토글 버튼 배치.
- 단어 클릭 이벤트 리스너: 클릭된 영어 텍스트 단어를 추출해 `DictionaryPopup` 활성화.

#### [NEW] [components/dictionary-popup.tsx](file:///Users/zorba/projects/nsq/components/dictionary-popup.tsx)

- 클릭된 단어를 전달받아 `https://api.dictionaryapi.dev/api/v2/entries/en/{word}` API 비동기 호출.
- 사전 검색 결과(품사, 주요 뜻 정의, 예문, 발음 오디오 링크 등)를 카드 팝업 레이아웃으로 렌더링.

#### [NEW] [components/tutor-chat.tsx](file:///Users/zorba/projects/nsq/components/tutor-chat.tsx)

- 우측 AI 튜터 챗 패널.
- Angela, Stephen, General 캐릭터 선택 탭 탑재. 탭 전환 시 활성화된 캐릭터 정보 갱신.
- 대화 내역은 `sessionStorage`에 직렬화하여 상태 저장 및 복원.
- 사용자가 입력창에 메시지를 전송하면 현재 에피소드 ID와 활성화된 캐릭터 ID, 현재 재생 중인 세그먼트 내용을 맥락 정보로 포함하여 `app/api/tutor/route.ts`로 요청.

#### [NEW] [app/api/tutor/route.ts](file:///Users/zorba/projects/nsq/app/api/tutor/route.ts)

- OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`) 호출 핸들러.
- 요청 본문으로 넘어온 캐릭터 유형(Angela, Stephen, General)에 따라 시스템 프롬프트(페르소나)를 구성:
  - **Angela**: 호스트 Angela Duckworth의 학구적이고 통계/인간행동에 흥미를 느끼며 동기부여를 주는 부드러운 대화 스타일.
  - **Stephen**: 호스트 Stephen Dubner의 호기심 가득하고 엉뚱한 의문을 제기하며 재치 있게 맞장구치는 스타일.
  - **General**: 교과서적인 친절하고 정확한 영어 피드백, 뉘앙스 차이 교정 위주의 튜터 스타일.
- `TRANSLATION_MODEL=google/gemini-2.5-pro` 모델로 API를 호출하여 스트리밍 또는 일반 JSON 응답 반환.

---

## 검증 시나리오 (Verification Plan)

### 1. 자동화 테스트 유효성

- `src/__tests__/alignTranscript.test.ts`를 구현하여, 골든 fixtures 폴더의 `transcript.txt`와 `subtitle.en.vtt`를 앵커링 알고리즘에 대입했을 때 `matchRate >= 0.85`를 만족하고 올바른 segments 배열이 산출되는지 Vitest로 확인.

### 2. 수동 기능 동작 테스트

- **파이프라인**: 정상 대본 URL 입력 시 빌드 완료 체크 ➔ 잘못된 대본 URL 입력 시 일치율 에러(matchRate 0.85 미만) 발생 유무 체크 ➔ 실패 단계(대본 or 자막) 개별 재시도 수행 정상 동작 체크.
- **번역 토글**: 개별 문장 번역 블러 유무 체크 ➔ 전체 토글로 번역 일괄 노출/해제 유무 체크.
- **사전 팝업**: 단어 클릭 시 Free Dictionary API 호출 후 카드 팝업에 정의 및 예문이 미려하게 표시되는지 확인.
- **집중 모드**: 세그먼트 구간 반복 중 녹음 ➔ 정지 ➔ 들어보기(재생) 버튼 클릭 시 내 목소리가 정상 출력되는지 검증.
- **경계 빽오프**: `seg.end == next.start` 구조의 연속 재생/반복 상황에서 index 판정이 반대로 튀지 않고 50ms 후퇴 파킹이 원활하게 유지되는지 콘솔이나 재생 헤드를 통해 확인.
- **AI 튜터**: 튜터 캐릭터 탭을 Angela ➔ Stephen ➔ General로 전환하며 대화를 걸었을 때, OpenRouter를 통해 각 캐릭터 고유의 말투와 영어 교정 답변이 `sessionStorage`에 실시간 누적되며 대화창에 렌더링되는지 확인.
