# multilingual — 이슈 분해 (issues.md)

> `prd.md`(A안) 기반 수직 슬라이싱. 각 이슈는 단독 완료 시 사용자에게 검증 가능한 동작을 낸다.
> 의존성: #124 → #125 → #126, #124 → (#127, #128, #129 병렬 가능). **[GATE 4] 승인 완료 — GitHub 등록됨(#124~#129).**

---

## Issue #124 — [multilingual] 언어 선택 + 자막 전용 임포트 (큐 세그먼트)

**목표**: transcriptUrl 없이 언어(ja)만 골라 임포트하면, 자동 자막 큐 단위 `segments.json`으로 에피소드가 completed되어 플레이어에서 재생·학습 가능하다.

**범위**

- `LanguageCode('en'|'ja')` 타입, `EpisodeMeta.language?`, `ImportState.language?` 추가 (부재 = en)
- `ImportRequestBody`: `transcriptUrl` 선택화 + `language?` 추가. `/api/import` 검증 갱신 (en+대본 없음 → subtitle-only 허용)
- `fetchSubtitle(videoId, youtubeUrl, lang)` — `--sub-langs {lang}`, `subtitle.{lang}.vtt` 산출 (기존 수동→자동 폴백 유지)
- `cueSegments`: VTT 큐 → 큐 세그먼트 변환(speaker `'SPEAKER'`), 자막 전용 모드에서 `segments.json` 기록
- `runImportPipeline` 모드 분기: transcriptUrl 부재 시 alignment·matchRate 게이트 생략
- ImportForm: 언어 세그먼티드 버튼(en/ja, 기본 en), ja 선택 시 대본 URL 입력 숨김
- meta.json에 language 영속, 플레이어/스크립트 뷰가 큐 세그먼트로 정상 동작하는지 확인(변경 없이 통과 예상)

**AC**

- Given 임포트 폼에서 언어 `ja` 선택(대본 URL 없음), When 유효한 유튜브 URL로 제출, Then 202 접수되고 `downloading → processing_subtitles → … → completed`로 진행되며 `subtitle.ja.vtt`와 큐 단위 `segments.json`·`meta.json(language:'ja')`이 생성된다.
- Given ja 임포트 completed, When 에피소드를 열면, Then 큐 단위 세그먼트가 스크립트 뷰에 표시되고 세그먼트 재생·A-B 반복이 동작한다.
- Given 언어 `en` + 대본 URL 입력, When 제출, Then 기존 대본 정합 경로가 그대로 실행된다(matchRate 게이트 포함, 회귀 없음).
- Given 자막이 전혀 없는 영상, When ja로 임포트, Then subtitle 단계에서 `failed`가 기록되고 모니터에 에러가 표시된다.

---

## Issue #125 — [multilingual] LLM 문장 복원 스텝 (sentence-builder)

**의존**: #124

**목표**: 파편화된 큐 세그먼트가 LLM으로 자연 문장 단위로 병합·구두점 복원되어 재생 구간이 문장 단위가 된다.

**범위**

- `src/lib/services/import/sentence-builder.ts`: 큐 배치(60개, 이전 배치 말미 문맥 힌트) → LLM(OpenRouter, DI 주입형) → `{복원 문장, 큐 인덱스 그룹}` 회수 → start/end는 그룹 첫/끝 큐 시각 → `segments.json` 재기록(증분 저장)
- 인덱스 검증(범위·연속성) 실패 배치는 스킵(해당 구간 큐 세그먼트 유지), best-effort
- `ImportState.status`에 `'building_sentences'`, RetryStep `'sentences'`(재사용: `subtitle.{lang}.vtt`) 추가, 모니터 단계 라벨 매핑
- 파이프라인 배선: 자막 전용 모드에서 큐 세그먼트 기록 직후 실행

**AC**

- Given ja 자막 전용 임포트, When 파이프라인이 완료되면, Then `segments.json`의 세그먼트가 문장 단위(구두점 포함)로 재구성되고 각 세그먼트의 start/end가 원 큐 시각 범위 내에 있다.
- Given LLM 전면 오류, When 임포트 실행, Then 큐 세그먼트 상태로 `completed`되고 재생이 가능하다(실패 미노출, 서버 로그 기록).
- Given 문장 복원이 누락된 에피소드, When `retryStep: 'sentences'` 재접수, Then 자막 재다운로드 없이 문장 복원만 재실행된다.

---

## Issue #126 — [multilingual] 언어별 번역 프롬프트 라우팅

**의존**: #125 (문장 단위 세그먼트에 번역이 실려야 품질 의미)

**목표**: ja 에피소드의 문장 세그먼트에 일본어→한국어 번역이 채워져 기존 blur/토글 UI로 학습 가능하다.

**범위**

- `translation.ts` 일반화: `createOpenRouterTranslator`에 `language` 인자 → 시스템 프롬프트 분기(ja→ko / en→ko)
- 하드코딩된 화자 접두사 제거 정규식(`DUCKWORTH|DUBNER|…`)을 임의 화자 대응으로 일반화
- 파이프라인이 `meta/state.language`를 translation 스텝에 전달, 자막 전용 모드에서도 translation 실행 + `retryStep: 'translation'` 동작 확인

**AC**

- Given ja 문장 세그먼트, When translation 스텝 실행, Then 각 세그먼트 `translation`에 자연스러운 한국어가 주입되고 스크립트 뷰 blur/전체 토글이 동작한다.
- Given en 에피소드, When 임포트, Then 기존 영→한 번역 품질·동작이 유지된다(프롬프트 회귀 없음).
- Given 번역 일부 누락, When `retryStep: 'translation'`, Then ja 프롬프트로 누락분만 보충된다(멱등).

---

## Issue #127 — [multilingual] 일본어 단어 하이라이트 + 사전 링크

**의존**: #124 (ja 세그먼트 존재. #125와 독립 — 큐 세그먼트에서도 동작)

**목표**: ja 에피소드 재생 중 현재 단어가 강조되고, 단어 클릭 시 네이버 일본어사전이 새 탭으로 열린다.

**범위**

- `src/lib/utils/tokenize.ts`: `Intl.Segmenter('ja', {granularity:'word'})` 래퍼(단어성 토큰 판별 포함), 미지원 환경 폴백(전체 1토큰)
- `SegmentText`: language `ja`면 공백 분해 대신 토크나이저 사용(세그먼트 단위 메모), 균등분할 인덱스 판정 재사용, 토큰 사이 공백 미삽입
- 단어 토큰 클릭 → `https://ja.dict.naver.com/#/search?query={단어}` 새 탭 (en은 기존 동작 무변경)
- 에피소드 language를 플레이어→SegmentText로 전달

**AC**

- Given ja 에피소드 재생 중, When 세그먼트가 발화 구간을 지나면, Then 현재 단어 토큰이 순차적으로 강조된다(문장이 통째로 강조되지 않음).
- Given ja 세그먼트 텍스트, When 특정 단어를 클릭, Then 해당 단어의 네이버 일본어사전 검색이 새 탭으로 열린다.
- Given en 에피소드, When 재생, Then 기존 공백 기반 하이라이트가 그대로 동작한다.

---

## Issue #128 — [multilingual] 후리가나 생성 + RubyText 렌더링

**의존**: #124 (ja 세그먼트), #125 권장(문장 단위에서 품질↑)

**목표**: ja 에피소드의 한자 위에 요미가나가 `<ruby>`로 표시되고 토글할 수 있다.

**범위**

- `src/lib/services/import/furigana.ts`: translation 동형 best-effort 배치 스텝 — LLM으로 세그먼트별 `ruby: {text, rt?}[]` 생성·`segments.json` 주입(멱등: ruby 있으면 스킵)
- 검증: `ruby.map(t=>t.text).join('') === segment.text` 불일치 시 해당 세그먼트 ruby 폐기
- `src/components/player/RubyText.tsx`: ruby 시퀀스를 `<ruby><rt>` 렌더, SegmentText와 합성(단어 하이라이트 공존)
- 컨트롤 헤더에 후리가나 토글(기본 ON, ja에서만 노출, #114 번역 토글 패턴)
- 파이프라인 배선(자막 전용 모드 translation 이후) — 전용 retryStep은 두지 않음(재생성은 범위 밖)

**AC**

- Given ruby 데이터가 있는 ja 세그먼트, When 스크립트 뷰 렌더, Then 한자 토큰 위에 요미가나가 표시되고 가나·비한자 토큰에는 rt가 없다.
- Given 후리가나 토글 OFF, When 스크립트 뷰 확인, Then 루비 없이 원문만 표시된다(토글 ON 시 복원).
- Given ruby 검증 실패(합성 불일치) 세그먼트, When 렌더, Then 크래시 없이 원문 텍스트로 폴백된다.
- Given LLM 오류로 ruby 전면 누락, When 임포트, Then completed 유지, 스크립트 뷰는 원문으로 정상 표시.

---

## Issue #129 — [multilingual] 다국어 튜터 페르소나

**의존**: #124 (language 속성)

**목표**: ja 에피소드에서 튜터가 일본어 학습 튜터로 전환되어 조사·활용 등 문법을 한국어로 설명한다.

**범위**

- `getTutorResponse`에 `language` 인자 추가: ja면 일본어 튜터 시스템 프롬프트(문법·표현 설명, 답변 한국어), en 기존 유지
- General 외 화자 페르소나 프롬프트도 언어 인자 반영
- TutorChat → `/api/tutor` → 서비스로 에피소드 language 전달(세그먼트 컨텍스트 주입 #120 경로 유지)

**AC**

- Given ja 에피소드에서 튜터에게 문장 질문, When 응답 수신, Then 일본어 문법(조사·활용 등) 관점의 한국어 설명이 스트리밍된다.
- Given en 에피소드, When 튜터 질문, Then 기존 영어 튜터 페르소나 응답이 유지된다.
- Given 활성 세그먼트가 선택된 상태, When 질문, Then ja 원문+번역 컨텍스트가 프롬프트에 주입된다.
