/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Content_OPS "Spent"(수동입력) 완전성 점검
 *
 * Responsibility
 * 사용자가 "Content_OPS의 Spent가 전체 데이터를 다 담고 있는 것 같지
 * 않다"고 지적(2026-08-25) — CONTENT.GROUP_3_MANUAL(Off/On/Campaign/
 * Start Date/End Date/Impressions/Reach/Link clicks/Results/Spent)은
 * 전부 Ops가 Meta Ads Manager에서 수동으로 옮겨 적는 컬럼이라
 * (CONTENT_004_Merge.js mergeContentOPS_() — 재빌드 때마다 기존 값을
 * copyColumns_()로 그대로 보존, 자동 재계산 없음. Events_OPS만 2026-08-06에
 * Spent를 GROUP_4_COMPUTED로 옮겨 자동 집계로 전환했고 BOFU/Content는
 * 아직 수동 그대로 — EVENTS_001_Config.js v1.9.0 참고), 사람이 빠뜨린
 * 캠페인/기간이 있어도 아무 에러 없이 조용히 누락된다.
 *
 * 검증 방법: Content_OPS 각 행의 수동 입력 Spent를 FY|Month(Start Date
 * 기준, applyContentDerivedDateColumns_()가 이미 계산해둔 FY/Month 컬럼
 * 그대로 사용)별로 합산한 뒤, 이미 검증된 단일 소스인 Ad_Spend_Cache
 * (AD_004_SpendCache.js readAdSpendCacheMap_(), Meta+Naver+Kakao 합산
 * NZD, segment="Content"만 필터)와 같은 FY|Month 버킷끼리 대조한다.
 * Meta_Raw를 직접 다시 훑어 캠페인명 매칭/기간 분배/정밀-분배 이중계상
 * 방지(aggregateMetaSpendByFYMonthSegment_() 내부 로직, AD_002_Meta.js)를
 * 새로 구현하지 않고 기존 캐시를 재사용 — 이 dedup 로직은 이미 한 번
 * 버그가 났던 영역이라(2026-07-30 정밀 export 우선 규칙) 여기서 새로
 * 다시 만들지 않는다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례). Ad_Spend_Cache가
 * 오래됐을 수 있으니(주기적 트리거로 갱신되지만) 결과 해석 시 캐시
 * 최신 여부를 감안할 것 — 필요시 AD_004_SpendCache.js
 * runPeriodicRefreshAdSpendCache() 먼저 실행 권장.
 *
 * INPUT: 없음 (Content_OPS + Ad_Spend_Cache 직접 스캔)
 * OUTPUT: Logger.log만 — FY|Month 버킷별 (수동 Spent 합계 vs Ad_Spend_Cache
 *   Content 합계 vs 차이), FY/Month가 없는(Start Date 공란) 행의
 *   수동 Spent 합계(버킷 비교 불가능분), 전체 요약.
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-25)
 * - Month 버킷 검증 추가(사용자 실행 결과 발견) — v1.0.0은
 *   `String(row["Month"])`를 무조건 3글자로 잘라 버킷 키를 만들었는데,
 *   일부 행의 "Month" 셀이 문자열("Jan" 등)이 아니라 실제 Date 객체를
 *   담고 있어("26|MON"/"26|SAT"/"26|THU" 등 요일 약어가 버킷으로 잘못
 *   나타남 — JS Date.toString()의 앞 3글자가 요일이라 발생) 잘못된
 *   버킷이 생겼음. 이제 12개월 화이트리스트로 검증하고, 통과 못 하는
 *   행은 별도로 모아 원인 진단용 샘플(key/Spent/Month 셀의 실제 타입과
 *   값)을 같이 출력 — 버킷 대조표 자체는 유효한 월만 사용.
 * v1.0.0 (2026-08-25)
 * - 최초 구현.
 * ==========================================================
 */

const CONTENT_SPENT_AUDIT_VALID_MONTHS_ = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

function runAuditContentSpentCompleteness() {

  const contentRows = readContentOPS_();

  const manualByBucket = {};
  let manualUnbucketed = 0;
  let manualTotal = 0;
  let malformedMonthTotal = 0;
  const malformedSamples = [];

  contentRows.forEach(function (row) {

    const spent = Number(row["Spent"]) || 0;
    manualTotal += spent;

    const fyRaw = String(row["FY"] || "").trim();
    const monthCell = row["Month"];
    const monthRaw = String(monthCell || "").trim();

    if (!fyRaw || !monthRaw) {
      manualUnbucketed += spent;
      return;
    }

    const fy = Number(fyRaw.replace(/^FY/i, ""));
    const month = monthRaw.toUpperCase().slice(0, 3);

    if (!fy || CONTENT_SPENT_AUDIT_VALID_MONTHS_.indexOf(month) === -1) {

      malformedMonthTotal += spent;

      if (malformedSamples.length < 20) {
        malformedSamples.push(
          row[CONTENT.KEY] +
          " | Spent=" + spent.toFixed(2) +
          " | FY셀=\"" + fyRaw + "\"" +
          " | Month셀 타입=" + (monthCell instanceof Date ? "Date" : typeof monthCell) +
          " | Month셀 값=\"" + monthRaw + "\""
        );
      }

      return;

    }

    const bucket = fy + "|" + month;
    manualByBucket[bucket] = (manualByBucket[bucket] || 0) + spent;

  });

  const cacheMap = readAdSpendCacheMap_();

  const cacheByBucket = {};

  Object.keys(cacheMap).forEach(function (key) {

    const parts = key.split("|");
    const segment = parts[2];

    if (segment !== "Content") return;

    const bucket = parts[0] + "|" + parts[1];
    cacheByBucket[bucket] = (cacheByBucket[bucket] || 0) + (Number(cacheMap[key]) || 0);

  });

  const allBuckets = {};
  Object.keys(manualByBucket).forEach(function (b) { allBuckets[b] = true; });
  Object.keys(cacheByBucket).forEach(function (b) { allBuckets[b] = true; });

  const bucketList = Object.keys(allBuckets).sort();

  Logger.log("========== Content_OPS Spent 완전성 점검 ==========");
  Logger.log("Content_OPS 총 행 수 : " + contentRows.length);
  Logger.log("Content_OPS Spent 합계(전체, 수동입력) : " + manualTotal.toFixed(2));
  Logger.log("  ㄴ FY/Month 버킷 매칭 불가(Start Date 공란 등) 행 합계 : " + manualUnbucketed.toFixed(2));
  Logger.log("  ㄴ Month 셀 형식이 비정상(월 이름 아님, 예: Date 객체) 행 합계 : " + malformedMonthTotal.toFixed(2));

  if (malformedSamples.length > 0) {
    Logger.log("     샘플(최대 20건):");
    malformedSamples.forEach(function (line) { Logger.log("       " + line); });
  }

  Logger.log("");
  Logger.log("---- FY|Month 버킷별 대조 (수동 Spent vs Ad_Spend_Cache Content, 월 형식 정상인 행만) ----");

  let cacheTotal = 0;
  let gapTotal = 0;
  let gapBucketCount = 0;

  bucketList.forEach(function (bucket) {

    const manual = manualByBucket[bucket] || 0;
    const cached = cacheByBucket[bucket] || 0;
    const diff = cached - manual;

    cacheTotal += cached;

    if (Math.abs(diff) > 1) {
      gapBucketCount++;
      gapTotal += diff;
    }

    Logger.log(
      bucket +
      " | 수동입력=" + manual.toFixed(2) +
      " | Ad_Spend_Cache=" + cached.toFixed(2) +
      " | 차이(Cache-수동)=" + diff.toFixed(2) +
      (Math.abs(diff) > 1 ? "  ⚠️" : "")
    );

  });

  Logger.log("");
  Logger.log("---- 요약 ----");
  Logger.log("Ad_Spend_Cache Content 합계(전체 버킷) : " + cacheTotal.toFixed(2));
  Logger.log("Content_OPS Spent 합계(버킷 매칭분만) : " + (manualTotal - manualUnbucketed - malformedMonthTotal).toFixed(2));
  Logger.log("차이 $1 이상 나는 버킷 수 : " + gapBucketCount + " / " + bucketList.length);
  Logger.log("그 버킷들의 차이 합계(Cache가 더 크면 양수 = 수동입력 누락 가능성) : " + gapTotal.toFixed(2));
  Logger.log("");
  Logger.log("========== Audit Completed ==========");

}
