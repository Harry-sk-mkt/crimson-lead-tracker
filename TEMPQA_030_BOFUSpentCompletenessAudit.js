/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — BOFU_OPS "Spent" 완전성 점검 (자동 집계 전환 검증용)
 *
 * Responsibility
 * `TEMPQA_029_ContentSpentCompletenessAudit.js`와 동일 목적의 BOFU 버전 —
 * Content_OPS 감사에서 수동 Spent가 사실상 비어있는 게 확인돼(2026-08-25)
 * `BOFU_001_Config.js` v1.5.0/`BOFU_002_Engine.js` v1.5.0으로 Spent를
 * Meta_Raw 자동 집계(GROUP_4_COMPUTED)로 전환했다 — 이 스크립트는 그
 * 전환이 실제로 잘 됐는지(값이 채워지는지) 확인하는 용도. BOFU_OPS 각 행의
 * (이제는 자동 계산된) Spent를 FY|Month별로 합산해 이미 검증된 단일 소스인
 * Ad_Spend_Cache(Meta+Naver+Kakao 합산 NZD, segment="BOFU"만 필터)와
 * 대조한다.
 *
 * TEMPQA_029와 동일하게 Meta_Raw를 직접 다시 훑어 dedup 로직을 새로
 * 구현하지 않고 기존 Ad_Spend_Cache를 재사용, Month 셀이 문자열이 아닌
 * 경우(Date 객체 등)를 별도로 걸러 원인 진단용 샘플을 같이 출력한다
 * (TEMPQA_029 v1.1.0에서 발견된 것과 같은 문제 클래스 대비).
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (BOFU_OPS + Ad_Spend_Cache 직접 스캔)
 * OUTPUT: Logger.log만 — FY|Month 버킷별 (Spent 합계 vs Ad_Spend_Cache
 *   BOFU 합계 vs 차이), 버킷 매칭 불가/Month 형식 비정상 행 합계, 요약.
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-08-25)
 * - 최초 구현.
 * ==========================================================
 */

const BOFU_SPENT_AUDIT_VALID_MONTHS_ = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
];

function runAuditBOFUSpentCompleteness() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BOFU.SHEET.OPS);

  if (!sheet) {
    Logger.log(BOFU.SHEET.OPS + " sheet not found — aborted.");
    return;
  }

  const bofuRows = sheetToObjects(sheet);

  const manualByBucket = {};
  let manualUnbucketed = 0;
  let manualTotal = 0;
  let malformedMonthTotal = 0;
  const malformedSamples = [];

  bofuRows.forEach(function (row) {

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

    if (!fy || BOFU_SPENT_AUDIT_VALID_MONTHS_.indexOf(month) === -1) {

      malformedMonthTotal += spent;

      if (malformedSamples.length < 20) {
        malformedSamples.push(
          row[BOFU.KEY] +
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

    if (segment !== "BOFU") return;

    const bucket = parts[0] + "|" + parts[1];
    cacheByBucket[bucket] = (cacheByBucket[bucket] || 0) + (Number(cacheMap[key]) || 0);

  });

  const allBuckets = {};
  Object.keys(manualByBucket).forEach(function (b) { allBuckets[b] = true; });
  Object.keys(cacheByBucket).forEach(function (b) { allBuckets[b] = true; });

  const bucketList = Object.keys(allBuckets).sort();

  Logger.log("========== BOFU_OPS Spent 완전성 점검 ==========");
  Logger.log("BOFU_OPS 총 행 수 : " + bofuRows.length);
  Logger.log("BOFU_OPS Spent 합계(전체) : " + manualTotal.toFixed(2));
  Logger.log("  ㄴ FY/Month 버킷 매칭 불가(Start Date 공란 등) 행 합계 : " + manualUnbucketed.toFixed(2));
  Logger.log("  ㄴ Month 셀 형식이 비정상(월 이름 아님, 예: Date 객체) 행 합계 : " + malformedMonthTotal.toFixed(2));

  if (malformedSamples.length > 0) {
    Logger.log("     샘플(최대 20건):");
    malformedSamples.forEach(function (line) { Logger.log("       " + line); });
  }

  Logger.log("");
  Logger.log("---- FY|Month 버킷별 대조 (BOFU_OPS Spent vs Ad_Spend_Cache BOFU, 월 형식 정상인 행만) ----");

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
      " | BOFU_OPS=" + manual.toFixed(2) +
      " | Ad_Spend_Cache=" + cached.toFixed(2) +
      " | 차이(Cache-BOFU_OPS)=" + diff.toFixed(2) +
      (Math.abs(diff) > 1 ? "  ⚠️" : "")
    );

  });

  Logger.log("");
  Logger.log("---- 요약 ----");
  Logger.log("Ad_Spend_Cache BOFU 합계(전체 버킷) : " + cacheTotal.toFixed(2));
  Logger.log("BOFU_OPS Spent 합계(버킷 매칭분만) : " + (manualTotal - manualUnbucketed - malformedMonthTotal).toFixed(2));
  Logger.log("차이 $1 이상 나는 버킷 수 : " + gapBucketCount + " / " + bucketList.length);
  Logger.log("그 버킷들의 차이 합계(Cache가 더 크면 양수 = 여전히 누락 가능성) : " + gapTotal.toFixed(2));
  Logger.log("");
  Logger.log("========== Audit Completed ==========");

}
