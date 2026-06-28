# Issue #22 — 임포트 폼 제출·접수 + /import 진입

> 근거: docs/features/import-ui/{spec-fixed,prd,issues}.md (Issue 1). 아키텍처 A.
> 컴포넌트 테스트 하니스(jsdom + React Testing Library)를 본 이슈에서 확립(전 import-ui UI 이슈 공용).

## 1. 시그니처 (확정)

```ts
// lib/utils/import-form.ts — 순수 검증(노드 환경 테스트 가능)
export function isSubmittable(
  youtubeUrl: string,
  transcriptUrl: string,
): boolean;
// 두 값 모두 trim 후 비어있지 않고 /^https?:\/\//i 형태일 때만 true.
```

```tsx
// components/import/ImportForm.tsx
export interface ImportFormProps {
  onAccepted?: (videoId: string) => void; // 202 접수 시 호출(페이지가 URL 동기화)
}
export function ImportForm(props: ImportFormProps): React.JSX.Element;
```

- 폼: youtubeUrl·transcriptUrl 입력(`ui/Input`), 제출 버튼(`ui/Button` primary).
- 제출 버튼은 `isSubmittable===false` 또는 제출 중이면 비활성.
- 제출: `POST /api/import {youtubeUrl, transcriptUrl}` →
  - 202 → `onAccepted(json.videoId)` + 접수 확인 표시.
  - 400 → `json.error` 인라인. 409 → "이미 {json.status} 상태입니다" 인라인. 500/기타 → 일반 인라인 에러. (인라인 영역 `role="alert"`)

```tsx
// app/import/page.tsx (client) — 폼 호스팅 + URL 동기화
// onAccepted(videoId) → router.replace(`/import?videoId=${videoId}`)
// app/page.tsx — '임포트하기' 링크(/import)
```

## 2. 테스트 하니스 (신규)

- devDeps: `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.
- `vitest.config.ts`: `test.setupFiles`에 jest-dom 매처 등록. 컴포넌트 테스트는 파일 상단 `// @vitest-environment jsdom` 프래그마(기존 node 테스트 속도 보존).

## 3. 테스트 시나리오 (8/8 통과)

### [정상]

- [x] `[정상] isSubmittable — should return true when both are non-empty http(s) URLs`
- [x] `[정상] ImportForm — should POST both URLs and call onAccepted(videoId) on 202`
- [x] `[정상] HomePage — should render an '임포트하기' link to /import`

### [경계]

- [x] `[경계] isSubmittable — should return false when either url is empty or not http(s)`
- [x] `[경계] ImportForm — should disable submit until both urls are valid`

### [예외]

- [x] `[예외] ImportForm — should show inline error on 400`
- [x] `[예외] ImportForm — should show "이미 {status} 상태" inline on 409`
- [x] `[예외] ImportForm — should show a generic inline error on 500`

## 4. AC ↔ 시나리오 교차 대조

| AC                                    | 커버                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| 빈값/비-http(s) → 제출 비활성         | isSubmittable false + ImportForm disable                           |
| 유효 → POST·202 시 URL 갱신·접수 확인 | ImportForm POST/onAccepted(202) + page router.replace(E2E #4 보강) |
| 400/409/500 → 인라인 에러             | 3개 예외 시나리오                                                  |
| 홈 → '임포트하기' → /import           | HomePage 링크                                                      |

> page의 `router.replace` URL 갱신은 onAccepted 콜백 계약으로 단위 커버 + 전체 URL 전이는 #4 E2E에서 검증.
