# Exec Plan Convention

`docs/exec-plans/` 디렉토리와 그 안 문서의 작성 규칙. OpenAI "Harness Engineering" 아티클의
exec-plan 패턴(https://openai.com/index/harness-engineering/)을 이 프로젝트 규모/워크플로에
맞게 축소 적용한 것 — 2026-07-30 도입.

## 목적

여러 세션·여러 머신(집/사무실)을 오가며 작업하는 이 프로젝트 특성상, 복잡한 작업의 "왜 이렇게
했는지"가 채팅 로그에만 남으면 다음 세션(또는 다른 머신의 세션)이 그 맥락을 이어받을 수 없다.
`docs/Changelog.md`가 세션 종료 후 사후 요약이라면, exec plan은 **작업 진행 중에 실시간으로
갱신되는 문서** — 진행 상황과 중간에 내린 판단을 그때그때 기록해, 작업이 오래 걸리거나 중간에
세션이 끊겨도 다음 세션이 처음부터 다시 파악할 필요가 없게 한다.

`docs/Roadmap.md`(장기 방향, 끝나지 않는 문서)와는 다른 목적 — exec plan은 **특정 작업 하나가
끝나면 완료 처리되는 태스크 단위 문서**다.

## 언제 만드는가

다음에 해당하면 exec plan을 만든다. 사소한 1회성 수정에는 만들지 않는다(오버헤드가 더 큼).

- 여러 세션에 걸칠 것으로 예상되는 작업
- 중간에 설계 판단이 여러 번 필요하거나, 그 판단 이유를 나중에 참조할 가능성이 높은 작업
- `docs/Roadmap.md`의 특정 항목을 실제로 착수할 때

## 생애주기

1. `docs/exec-plans/active/`에 새 파일 생성 (파일명 규칙: `YYYY-MM-DD-짧은-슬러그.md`, 예:
   `2026-07-30-target-rep-verification.md`)
2. 작업 진행하면서 아래 템플릿의 섹션들을 계속 갱신 — 작업 끝나고 한 번에 몰아 쓰지 않는다.
3. 작업이 끝나면 Outcomes & Retrospective를 채운 뒤 `docs/exec-plans/completed/`로 파일을 이동
   (`git mv`).
4. 완료된 exec plan은 그 자체가 기록이므로 내용을 사후에 고치지 않는다 — 새로 발견한 사실은 새
   exec plan이나 `docs/Changelog.md`에 남긴다.

## 템플릿

```markdown
# <작업명>

**관련 로드맵 항목**: docs/Roadmap.md의 어느 항목인지 (해당 시)
**시작일**: YYYY-MM-DD

## Goal

이 작업이 끝나면 무엇이 달라져 있어야 하는가.

## Progress

- [ ] 체크리스트 또는 진행 로그. 세션마다 이어서 추가.

## Surprises & Discoveries

작업 중 예상과 다르게 발견한 사실 (예: 문서에 적힌 필드가 실제 raw export에 없더라 등).

## Decision Log

중간에 내린 설계 판단과 그 이유. 나중에 "왜 이렇게 했더라"를 다시 묻지 않기 위한 기록.

## Outcomes & Retrospective

(완료 시점에 작성) 최종적으로 무엇이 구현/검증됐는지, 남은 한계는 무엇인지.
```

## `docs/Changelog.md`와의 역할 분리

- exec plan: 진행 중 작업의 실시간 작업 기록 (해당 작업 하나에 스코프)
- `docs/Changelog.md`: 세션 종료 시점의 사후 요약 (여러 exec plan/작은 수정을 모두 아우름)

완료된 exec plan이 있으면 그 세션 종료 시 Changelog 항목에서 링크만 걸고 내용을 중복 기술하지
않는다.
