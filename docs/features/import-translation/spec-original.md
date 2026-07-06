# import-translation — 초기 아이디어 (spec-original)

> 초기 기능 정의서. 인터뷰(Stage 1)를 거쳐 `spec-fixed.md`로 확정된다.

## 한 줄 정의

임포트 파이프라인의 **마지막 단계로 번역 스텝을 추가**한다. 정합 완료된 `segments.json`의 영어 문장(`text`)을 한국어로 번역해 각 세그먼트의 `translation` 필드에 주입·영속화한다.

## 출처 (checklist.json)

- **id**: `import-translation` · **phase**: MVP · **status**: pending
- **path**: `src/lib/services/import/translation.ts`
- **relatedPaths**: `src/lib/services/import-pipeline.ts`
- **description**: "정합된 segments.json 대본의 영어 문장들을 한글로 번역하여 translation 필드 주입 (LLM 또는 외부 번역 API 연동)"

## 현재 코드베이스 정황 (source of truth)

| 항목                                         | 현황                                            | 의미                     |
| :------------------------------------------- | :---------------------------------------------- | :----------------------- |
| `Segment.translation?: string`               | **이미 정의** (`types.ts:7`)                    | 저장 스키마 준비됨       |
| `ImportState.status`에 `'translating'`       | **이미 정의** (`types.ts:41`)                   | 상태 슬롯 준비됨(미사용) |
| ScriptView 번역 표시(blur/개별해제/전체토글) | **완성** (`script-view-translation`)            | 소비 UI 준비됨           |
| `runImportPipeline` 오케스트레이터           | align → meta → completed                        | **번역 스텝 없음**       |
| `PipelineSteps` DI 계약                      | download/subtitle/transcript/alignment/meta     | 번역 스텝 추가 필요      |
| LLM/번역 SDK 의존성                          | **전무** (fetch 직접 추정, node v25 내장 fetch) | provider 신규 연동       |
| 환경변수                                     | `.env.example`에 yt-dlp만                       | 번역 API 키 신규 필요    |

## 미결 질문 (인터뷰에서 확정)

1. 번역 제공자(provider): OpenRouter LLM vs 외부 번역 API(Google/DeepL)
2. 번역 실패 시 파이프라인 처리(best-effort vs 하드 실패)
3. 재실행·재시도(retryStep) 통합 및 멱등성(이미 번역된 세그먼트 스킵)
4. 번역 품질 정책(문맥 유지 배치 vs 문장 독립) 및 비용/지연 예산
5. 대상 범위(모든 화자 세그먼트 포함 여부, NARRATOR 등)
