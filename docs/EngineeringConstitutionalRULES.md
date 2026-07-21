# Engineering Constitutional RULES

## Article 1. Source of Truth
- 현재 대화와 현재 프로젝트의 코드만 Source of Truth로 사용. Memory를 근거로 구현하지 않음.
- 더 나은 구조가 떠오르면: 먼저 제안 → 장단점 설명 → 사용자 승인 후 적용.

## Article 2. No Assumptions
절대 추론하지 않는다. 모르면 반드시 질문한다.
추론 금지 대상: Sheet 이름, Range, Column Index, Header, Business Logic, Existing Function, Existing Architecture.

## Article 3. Test Driven Development
```
Requirement → Test Case 작성 → Code 작성 → User Test → PASS → 다음 단계
```

## Article 4. Complete Delivery
항상 파일 단위 전체 코드를 전달한다. 부분 함수/조각 전달 금지. Syntax Error 없이 실행 가능한 상태여야 함.

## Article 5. Backward Compatibility
기존 기능을 깨뜨리는 변경 금지: File Name, Public Function Name, Function Signature, Existing Sheet, Existing Formula, Existing Output.
Breaking Change 필요 시 반드시 사용자 승인 후 진행.

## Article 6. Definition of Done
구현 완료 + Syntax Error 없음 + Runtime Error 없음 + 테스트 통과 + 기존 기능 정상 + 사용자 승인.

## Article 7. Single Responsibility
One File → One Responsibility / One Function → One Responsibility. Business Logic은 한 곳에서만 관리.

## Article 8. Dependency Rule

> ⚠️ 2026-07-21 업데이트 필요 — 원본 표기와 실제 구조가 다름

**원본 문서 표기:**
```
Menu → Import → CsvReader → Parser → Validator → Loader → Utils
```

**실제 구조 (확정):**
```
Menu → Import → CsvReader → Parser → Validator → RawWriter → SheetWriter → Utils
```
"Loader"라는 파일은 없음 — 실제로는 `RawWriter`(Raw 전용, specific)와 `SheetWriter`(제네릭, 공용)로 분리되어 있음.

역방향 호출 금지, Circular Dependency 금지.

## Article 9. Import Rule
- CSV는 항상 Raw Text로 읽는다.
- Date/Number/Boolean 생성은 Parser/TransformHelper만 허용.
- Writer는 쓰기만 수행. Validator는 검증만 수행.

## Article 10. Performance
```
Read Once → Parse Once → Write Once
```
금지: Row별 setValue(), 동일 데이터 재파싱, 동일 Sheet 반복 접근.
허용: setValues(), batch 처리.

> 2026-07-21: 이 원칙을 근거로 Master Build를 Incremental Append 방식으로 전환 (매주 전체 재계산 방지).

## Article 11. Configuration
하드코딩 금지(Sheet 이름, Column Index, Header, 상수, Format). 모든 설정은 `00_Config.js`에서 관리.
→ 상세: `config-centralization-rule.md`

## Article 12. Logging
모든 Import는 최소 기록: 시작 시간, 종료 시간, Import Type, Record 수, Error 여부, 처리 시간.

## Article 13. Error Handling
- Error 발생 시 부분 저장 금지. Silent Failure 금지.
- 사용자가 무엇이 왜 실패했는지 알 수 있어야 함.

## Article 14. Refactoring Rule
Patch를 만들지 않는다. 급한 수정도 기존 구조 안에서 해결. 새 구조 필요 시: 제안 → 승인 → 적용.

## Article 15. Development Workflow
```
Requirement → Architecture Review → Test Case → Implementation → User Test → Review → Approval → Next Task
```

## Article 16. Change Log
모든 코드 변경은 파일 상단에 변경 이력(Version, Date, Author, Change Summary)을 기록한다.

---

## Engineering Principle
> "Make it correct first. Make it simple second. Make it fast third. Never sacrifice correctness for convenience."

## 함수 문서화 형식
```
/**
 * WHY
 * INPUT
 * OUTPUT
 * SIDE EFFECT
 * TEST
 * EXPECTED RESULT
 */
```