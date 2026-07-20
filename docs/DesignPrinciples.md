# Design Principles (Marketing 2.0)

## Single Responsibility
각 모듈은 정확히 하나의 책임만 수행한다.

## Raw is Immutable
Raw 테이블은 항상 임포트된 원본 데이터를 보존한다. Raw는 수동으로 절대 수정하지 않는다.
(2026-07-21부터: Raw는 매 Import마다 전체 삭제 후 재작성이 아니라 **Append** 방식으로 데이터가 누적된다.
 원본 값은 여전히 Plain Text로 보존되며, 스크립트 외의 방식으로 손대지 않는다.)

## Master is Rebuildable
Master는 언제든 Raw로부터 재생성될 수 있다. CSV 재임포트는 필요하지 않다.
(2026-07-21부터: 평상시엔 Incremental Append로 운영하고, Business Rule이 바뀌는 등
 전체 재계산이 필요할 때만 별도의 Full Rebuild 함수를 수동 실행한다.)

## Reports are Disposable
리포트는 생성된 산출물이다. 언제든 삭제하고 재생성할 수 있다.

## Operational Sheets are Disposable
Operational Sheets는 Master로부터 생성된다. 수동으로 절대 수정하지 않는다.

> ⚠️ **주의**: 이 원칙은 **레거시 Operational Sheets(Lead Tracker/SAL/IC/FTA)** 기준이다.
> **`Leads_OPS`는 이 원칙의 예외 레이어**로, Salesforce weekly snapshot과 실무 체크 사이의
> 중간 계층 역할을 하며 **의도적으로 수동 편집(마케팅 관리 컬럼)을 보존**하는 것이 핵심 설계 목적이다.
> `Leads_OPS`에는 "Disposable / 수동편집금지" 원칙이 적용되지 않는다.

## Configuration is Centralized
모든 설정 값은 `00_Config.js`에만 존재한다. 중복된 상수는 없다.
→ 상세: `config-centralization-rule.md`

## Generic before Specific
- Generic 모듈: Sheet Writer, CSV Reader
- Specific 모듈: Lead Transformer, MTA Transformer, ACQ Engine

Generic 모듈은 절대 business logic을 포함하지 않는다.