# multilingual — 초기 아이디어 (spec-original)

> 출처: `checklist.json` → `phase2-multilingual` 페이즈 (Phase 2)

## 한 줄 아이디어

Freakonomics(영어+공식 대본) 전용인 현재 임포트·학습 파이프라인을 **대본이 없는 다국어(우선 일본어) 유튜브 영상**까지 확장한다. 자동 자막만으로 임포트하고, 일본어 학습에 필요한 표시(후리가나·단어 하이라이트)와 번역·튜터를 언어에 맞게 분기한다.

## checklist.json 태스크 원문

| id                            | feature                              | 설명                                                                      |
| :---------------------------- | :----------------------------------- | :------------------------------------------------------------------------ |
| multilingual-youtube-subs     | 유튜브 자동 자막(VTT) 추출           | 수동 스크립트가 없을 경우 yt-dlp --write-auto-subs를 통해 자동 자막 추출  |
| multilingual-sentence-builder | AI 기반 문장 복원 및 구두점 생성     | 파편화된 자동 자막을 LLM을 통해 자연스러운 문장으로 병합 및 마침표 복원   |
| multilingual-translation      | 다국어 지원 및 번역 프롬프트 분기    | 언어 속성(ja/en) 추가 및 일본어→한국어 번역 등 프롬프트 동적 라우팅       |
| multilingual-furigana         | 후리가나(Furigana) 렌더링 지원       | 한자에 루비 태그(&lt;ruby&gt;) 렌더링 지원                                |
| multilingual-tokenizer        | 띄어쓰기 없는 언어의 단어 하이라이트 | 형태소 분석(Kuromoji/LLM)을 통한 단어 구분 및 단어별 클릭(사전 연동) 지원 |
| multilingual-tutor            | 다국어 튜터 페르소나 적용            | 언어(ja)에 따라 문법(조사 등) 설명 및 일본어 튜터로 프롬프트 전환         |
