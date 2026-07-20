# Hidden Helper Date Column

`Leads_Master`는 숨겨진 helper column(`Created Date Helper`)을 사용하여
Salesforce의 텍스트 날짜를 native Google Sheets date 값으로 변환한다.

## 파생 필드
Helper column으로부터 다음 항목을 도출한다:
- Created FY
- Created Quarter
- Created Week

## Benefits
- 날짜 파싱 로직 중앙화
- 단순화된 수식
- 성능 향상
- Leads_Master와 MTA_Master 간 일관된 로직

## 알려진 불일치 (미해결 — 임의로 통일하지 말 것)
- `12_LeadTransformer.js`: `"Created Date Helper": createdDate` → **Date 객체**
- `13_MTATransformer.js`: `"Created Date Helper": getMonthKey(mtaCreatedDate)` → **문자열** (예: `"2026-08"`)

같은 이름의 필드가 두 Master 테이블에서 타입이 다름. 의도된 차이인지 버그인지 미확인.

> 이 helper column은 날짜 자체의 정확한 파싱 여부와는 별개 개념이다.
> 날짜 파싱 버그 자체는 `import-date-parsing-bug.md` 참고.