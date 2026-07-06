# CLAUDE.md

## 정책 (Directives)

- `any` 타입 사용 금지. 명시적 타입 정의를 지향한다.
- 임포트 시 상대 경로 대신 절대 경로 별칭 `@/`를 사용한다.
- 색상은 반드시 CSS 변수로만 사용한다 (하드코딩 금지).
- 스펙에 없는 임의의 spacing 픽셀값 사용 금지.
- 디자인 시스템 명세 → `docs/design-system/DESIGN.md` 참조.
- 환경 변수(API 키 등)는 `.env.local`에 격리. `.env.example` 참조.

## 도메인 규칙

- **matchRate 임계값**: 대본↔자막 정합 품질 `matchRate < 0.85`이면 임포트 실패 처리한다.
- **오디오 경계 Back-off**: 세그먼트 전환 오동작 방지를 위해 `BOUNDARY_PARK_BACKOFF_SEC = 0.05`를 적용한다.

## TDD 이슈 사이클

새 이슈 작업 시 다음 순서를 따른다:

0. 자식 브랜치 생성 — 분기 전 부모 feature 브랜치를 먼저 push해 로컬·원격을 맞춘 뒤 `git checkout -b <feature>-issue-N`
1. /test-scenarios N — 시그니처 + 시나리오 (skill)
2. /tdd-red N — 실패 테스트 작성 (skill)
3. /tdd-green N — 최소 구현, 테스트 전체 통과 (skill)
4. @ac-verifier N — AC 충족 독립 검증, 테스트 통과 ≠ AC 충족 (agent)
5. /tdd-refactor N — 구조 개선, 깨지면 즉시 롤백 (skill)
6. /security-review N — 타입·보안 점검 (skill)
7. commit (관심사별 분리 커밋, conventional)
8. PR: 자식 → 부모 feature 브랜치 (`--base <feature>`) → squash merge → 자식 브랜치 삭제 → 이슈 클로즈

각 단계는 인간 승인 게이트가 있다. **자동으로 다음 단계로 넘어가지 말 것.**
이슈 의존성이 있으면 선행 이슈가 머지된 feature 브랜치에서 분기.

> **이슈 자동 클로즈**: GitHub는 클로징 키워드(`Closes #N`)가 **기본 브랜치(main)** 로 머지될 때만 자동으로 닫는다. 자식→부모(feature) PR로는 닫히지 않으니, feature→main 통합 PR 본문에 `Closes #N`을 모아 넣어 main 머지 시 일괄 클로즈한다.
>
> **분기 전 부모 push 필수**: 부모 feature 브랜치에 로컬 커밋을 쌓았다면 자식 분기 전에 반드시 push한다. 안 하면 자식 PR squash 머지 시 부모의 로컬·원격이 갈라져 `gh pr merge --delete-branch`가 로컬 정렬에 실패한다.
