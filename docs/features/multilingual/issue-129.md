# Issue #129 — [multilingual] 다국어 튜터 페르소나

> `/test-scenarios 129` 산출. 승인 게이트는 사용자 상시 정책(추천안 자동 진행)으로 통과 처리.

## 1. 시그니처 명세

### 1-1. 튜터 서비스 (`src/lib/services/tutor.ts`)

```ts
/**
 * language 인자 추가(기본 'en' — 기존 호출 무변경).
 * - 'en': 기존 영어 학습 튜터 페르소나 문자열 그대로(회귀 없음).
 * - 'ja': 일본어 학습 튜터 페르소나 — 조사·활용 등 문법과 표현을 한국어로 설명.
 *   General 외 화자 페르소나 프롬프트도 동일하게 언어 분기.
 */
export async function getTutorResponse(
  speakerId: string,
  message: string,
  context?: { text: string; translation?: string },
  language?: LanguageCode, // 기본 'en'
): Promise<ReadableStream>;
```

### 1-2. API 라우트 (`src/app/api/tutor/route.ts`)

- 바디에 `language?: 'en' | 'ja'` 수용 — 부재 시 `'en'`, 그 외 값 → **400**.
- `getTutorResponse(speakerId, message, context, language)`로 전달.
- 기존 검증(message 필수, General 전용, context 형태)·SSE 응답 유지.

### 1-3. 클라이언트 (`TutorChat.tsx`, `shadowing-player.tsx`)

```ts
export interface TutorChatProps {
  className?: string;
  context?: { text: string; translation?: string };
  speakers?: string[];
  language?: LanguageCode; // 신규, 기본 'en'
}
```

- `TutorChat`: POST 바디에 `language` 포함(`{ speakerId, message, context, language }`).
- `ShadowingPlayer`: 기존 파생 `language`를 `TutorChat`에 전달(세그먼트 컨텍스트 주입 #120 경로 유지).

## 2. 테스트 시나리오

### getTutorResponse (tutor)

- [x] [정상] getTutorResponse — should use Japanese-learning tutor persona (문법 설명·한국어 답변) when language is 'ja'
- [x] [정상] getTutorResponse — should keep the existing English tutor persona when language is omitted (기존 회귀)
- [x] [정상] getTutorResponse — should append ja segment context (원문+번역) to the system prompt when provided
- [x] [경계] getTutorResponse — should apply ja persona to non-General speaker prompts as well

### POST /api/tutor (route)

- [x] [정상] POST — should forward language to getTutorResponse when body has language 'ja'
- [x] [정상] POST — should default language to 'en' when omitted (기존 회귀)
- [x] [예외] POST — should return 400 when language is unsupported

### TutorChat / ShadowingPlayer (배선)

- [x] [정상] TutorChat — should include language in the POST body when language prop is 'ja'
- [x] [정상] TutorChat — should default language to 'en' in the POST body when prop omitted (기존 회귀)
- [x] [정상] ShadowingPlayer — should pass episode language to TutorChat

## 3. AC 교차 대조

| AC                                                                            | 커버 시나리오                                           |
| :---------------------------------------------------------------------------- | :------------------------------------------------------ |
| AC1: ja 에피소드 튜터 질문 → 일본어 문법(조사·활용) 관점 한국어 설명 스트리밍 | ja 페르소나 + route 전달 + TutorChat 바디 + Player 배선 |
| AC2: en 에피소드 → 기존 영어 튜터 페르소나 유지                               | en 회귀(서비스·route·TutorChat 기본값)                  |
| AC3: 활성 세그먼트 선택 상태 질문 → ja 원문+번역 컨텍스트 주입                | ja 컨텍스트 주입 시나리오(#120 경로 유지)               |
