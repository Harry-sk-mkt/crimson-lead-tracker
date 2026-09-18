/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — Events_OPS "Time"(I열) 값 유실 진단 (사용자 보고, 2026-09-18)
 *
 * Responsibility
 * 사용자가 Events_OPS I열(Time, GROUP_1_MANUAL)에 입력해둔 값이 사라졌다고
 * 보고. EVENTS_004_Merge.js의 mergeEventsOPS_()/copyColumns_()를 코드
 * 리뷰한 결과 Time은 PIC/Speaker/Division/Notes와 완전히 동일한 방식
 * (GROUP_1_MANUAL, 키 매칭 시 그대로 복사)으로 처리돼 JS 로직 안에 Time만
 * 다르게 취급하는 분기가 없음을 확인 — 그런데 사용자 확인상 실제로는
 * Time만 비고 나머지 Manual 컬럼은 멀쩡함. 코드만으로는 이 이상 원인을
 * 좁힐 수 없어, 실제 시트 현재 상태를 스캔해 다음을 확인하기 위한 1회성
 * 진단:
 * (1) Time이 비어있으면서도 다른 Manual 컬럼(Mkt Reg./PIC/Speaker/Notes)은
 *     채워져 있는 "의심 행"(=Ops가 분명히 손댄 적 있는 행인데 Time만
 *     빠진 경우) — 이게 많으면 실제 유실 버그, 적으면 애초에 Time을
 *     안 채운 행일 가능성.
 * (2) 현재 Time 값이 남아있는 셀들의 실제 저장 타입(Date 객체 vs 문자열
 *     등) — 타입이 뒤섞여 있으면 라운드트립(읽기→병합→쓰기) 과정에서
 *     타입 불일치로 인한 유실 가능성을 뒷받침.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Events_OPS 직접 스캔, readEventsOPS_() 재사용)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-18)
 * - 최초 구현.
 * ==========================================================
 */
function runCheckEventsTimeColumnDiagnostic() {

  const rows = readEventsOPS_();

  if (!rows || rows.length === 0) {
    Logger.log("Events_OPS에서 읽은 행이 없습니다 (시트가 비어있거나 헤더 행을 못 찾음).");
    return;
  }

  function isBlank(v) {
    return v === "" || v === null || v === undefined;
  }

  const blankTime = [];
  const filledTime = [];

  rows.forEach(function (r) {
    if (isBlank(r["Time"])) {
      blankTime.push(r);
    } else {
      filledTime.push(r);
    }
  });

  Logger.log("========== Events_OPS Time(I열) 진단 ==========");
  Logger.log("전체 행 수         : " + rows.length);
  Logger.log("Time 값 있음       : " + filledTime.length);
  Logger.log("Time 값 없음(공란) : " + blankTime.length);
  Logger.log("");

  /*
  ==========================================================
  의심 행 — Time은 비어있는데 다른 Manual 컬럼(Ops가 분명히 손댄 흔적)은
  값이 있는 경우. Event Date/EventType은 자동 재채움 로직이 있어 제외.
  ==========================================================
  */

  const suspicious = blankTime.filter(function (r) {

    const mktReg = Number(r["Mkt Reg."]) || 0;

    const hasOtherManual =
      mktReg > 0 ||
      String(r["PIC"] || "").trim() !== "" ||
      String(r["Speaker"] || "").trim() !== "" ||
      String(r["Notes"] || "").trim() !== "" ||
      String(r["Division"] || "").trim() !== "";

    return hasOtherManual;

  });

  Logger.log("Time만 비고 다른 Manual 데이터(Mkt Reg./PIC/Speaker/Notes/Division)는 있는 '의심' 행 : " + suspicious.length);
  Logger.log("");

  suspicious.forEach(function (r) {
    Logger.log(
      "  - Marketo Campaign name=[" + r["Marketo Campaign name"] + "]" +
      " | Lead Source Detail=[" + r["Lead Source Detail"] + "]" +
      " | Event Date=" + r["Event Date"] +
      " | Mkt Reg.=" + r["Mkt Reg."] +
      " | PIC=" + r["PIC"] +
      " | Speaker=" + r["Speaker"] +
      " | Division=" + r["Division"] +
      " | Notes=" + r["Notes"]
    );
  });

  Logger.log("");
  Logger.log("Time 값이 실제로 남아있는 셀의 저장 타입 샘플 (최대 15건):");

  filledTime.slice(0, 15).forEach(function (r) {

    const t = r["Time"];
    const typeInfo = (t instanceof Date)
      ? ("Date 객체, ISO=" + t.toISOString() + ", getHours/Minutes=" + t.getHours() + ":" + t.getMinutes())
      : (typeof t + ", raw=" + JSON.stringify(t));

    Logger.log("  - [" + r["Marketo Campaign name"] + "] Time=" + typeInfo);

  });

  Logger.log("=================================================");
  Logger.log(
    "판단 기준: '의심' 행 목록에 실제로 사용자가 Time을 입력했던 이벤트명이 " +
    "보이면 유실 확정 — 그 목록을 캡처해서 알려주시면 원인(병합 충돌/타입 " +
    "라운드트립) 쪽으로 좁혀서 코드를 고치겠습니다. 목록이 비어있거나 " +
    "전혀 관계없는 행뿐이면, Time을 실제로 입력한 적 없는 행일 가능성이 " +
    "높습니다."
  );

}
