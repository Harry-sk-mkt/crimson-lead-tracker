/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — 8월 SAL(305) vs ACQ_REP(243) 리드 단위 대조
 * (docs/OpenItems.md #32 후속 조사, 사용자가 제공한 Salesforce SAL 리포트
 * CSV 전체 304건 기준 — TEMPQA_037/040과 동일 방법론, Email 기준 매칭)
 *
 * Responsibility
 * TEMPQA_041 실측 결과, SAL은 캐시=원본재계산(243)이 정확히 일치해 캐시
 * 지연이 아니라 진짜 데이터 갭으로 확인됨. 사용자가 제공한 Salesforce SAL
 * 리포트(Lead Status별 분포: Disqualified 156/Attempting Contact 61/
 * Qualified 33/IC Booked 21/New(Not Contacted) 17/Contacted 16, 합계 304 —
 * Nurturing 행이 0건이라 `docs/OpenItems.md` #10의 제외 규칙과 무관하게
 * 304건 전부 SAL 대상)을 Leads_OPS와 Email 단위로 1:1 대조해 갭의 정확한
 * 원인을 좁힌다.
 *
 * IC Funnel 조사(TEMPQA_042~044)와 달리 SAL은 별도의 Lead 레벨 Raw 리포트가
 * 없고 여전히 MTA_Master 터치 기반 동기화(`MASTER_003_MTAFunnelSync.js`)뿐이라,
 * 이 CSV 대조가 유일한 검증 수단이다.
 *
 * 분류:
 * (1) Leads_OPS에 아예 없음 — Leads Import 공백(TEMPQA_043과 같은 종류의
 *     리포트 범위 불일치 가능성)
 * (2) Leads_OPS엔 있는데 Sales Accepted Date가 비어있거나 8월이 아님 —
 *     터치 기반 동기화 지연(그 리드에 새 마케팅 터치가 없어 상태 갱신 안 됨)
 * (3) 정상 일치(Sales Accepted Date가 8월)
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Leads_OPS 직접 스캔, Salesforce 목록은 사용자가 제공한 CSV
 *   report1788230494692.csv에서 채굴해 하드코딩 — Email + Lead Status)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.0.0
 *
 * Change Log
 * v1.0.0 (2026-09-01)
 * - 최초 구현.
 * ==========================================================
 */
function runCompareAugustSALAgainstSalesforce(){

  const TARGET_FY = 27;
  const TARGET_MONTH = "AUG";

  // [Email(소문자), Salesforce Lead Status]
  const SALESFORCE_SAL_AUGUST = [
  ["02826@naver.com","New (Not Contacted)"],
  ["jnoh12@gmail.com","New (Not Contacted)"],
  ["yeonwooobear@gmail.com","New (Not Contacted)"],
  ["florenciayuri77@gmail.com","New (Not Contacted)"],
  ["harangkim0520@naver.com","New (Not Contacted)"],
  ["alexanderiacarnez@icloud.com","New (Not Contacted)"],
  ["angelzhyun@gmail.com","New (Not Contacted)"],
  ["nisheshshah@gmail.com","New (Not Contacted)"],
  ["t01085507624@gmail.com","New (Not Contacted)"],
  ["a01083358602@icloud.com","New (Not Contacted)"],
  ["chloechu0716@gmail.com","New (Not Contacted)"],
  ["lilusya2003@gmail.com","New (Not Contacted)"],
  ["hacheamin09@gmail.com","New (Not Contacted)"],
  ["jihyeon927@icloud.com","New (Not Contacted)"],
  ["cuishabu@naver.com","New (Not Contacted)"],
  ["ijungeon370@gmail.com","New (Not Contacted)"],
  ["2020s2204@paekyang.ms.kr","New (Not Contacted)"],
  ["w@gmail.com","Attempting Contact"],
  ["firstsnow80@gmail.com","Attempting Contact"],
  ["eunji0601@naver.com","Attempting Contact"],
  ["lilyfeel0930@gmail.com","Attempting Contact"],
  ["sendtolea82@gmail.com","Attempting Contact"],
  ["sunyoukim02@nate.com","Attempting Contact"],
  ["jungjuseo.01@gmail.com","Attempting Contact"],
  ["mjb202@naver.com","Attempting Contact"],
  ["sooyoung1231@gmail.com","Attempting Contact"],
  ["hyoju.celine@gmail.com","Attempting Contact"],
  ["jessjiahpark@gmail.com","Attempting Contact"],
  ["shanagirl@hanmail.net","Attempting Contact"],
  ["woommusic1@gmail.com","Attempting Contact"],
  ["likes@hanyang.ac.kr","Attempting Contact"],
  ["psy10402@naver.com","Attempting Contact"],
  ["yuri391mono@gmail.com","Attempting Contact"],
  ["lytoy@hanmail.net","Attempting Contact"],
  ["coincidence_@hanmail.net","Attempting Contact"],
  ["utopiask@naver.com","Attempting Contact"],
  ["artnsci08@gmail.com","Attempting Contact"],
  ["sasakchoi11@gmail.com","Attempting Contact"],
  ["beaunose00@gmail.com","Attempting Contact"],
  ["terikim08@gmail.com","Attempting Contact"],
  ["junseogang67@gmail.com","Attempting Contact"],
  ["dbdbswo0207@gmail.com","Attempting Contact"],
  ["a01050061381@gmail.com","Attempting Contact"],
  ["twentyooo8@gmail.com","Attempting Contact"],
  ["9607002@gmail.com","Attempting Contact"],
  ["fggjhfdfghy@naver.com","Attempting Contact"],
  ["eunseobag502@gmail.com","Attempting Contact"],
  ["sohyonyang5454@gmail.com","Attempting Contact"],
  ["sophiagracebek@gmail.com","Attempting Contact"],
  ["byeolhahwang6@gmail.com","Attempting Contact"],
  ["happyun12341234@gmail.com","Attempting Contact"],
  ["yejinreah1023@gmail.com","Attempting Contact"],
  ["tnalslek79@gmail.com","Attempting Contact"],
  ["yeonho1101kang@gmail.com","Attempting Contact"],
  ["fizzer01@naver.com","Attempting Contact"],
  ["vi462544@gmail.com","Attempting Contact"],
  ["captainminhoo@gmail.com","Attempting Contact"],
  ["wwjd0322@hotmail.com","Attempting Contact"],
  ["jh.julie.lee@gmail.com","Attempting Contact"],
  ["yoonds0307@gmail.com","Attempting Contact"],
  ["hanna-yu@naver.com","Attempting Contact"],
  ["jdiej2141@gmail.com","Attempting Contact"],
  ["joeunsung0808@gmail.com","Attempting Contact"],
  ["cfcf2011@naver.com","Attempting Contact"],
  ["esmebp11@gmail.com","Attempting Contact"],
  ["2012mgkim@gmail.com","Attempting Contact"],
  ["kimsungwon0317@gmail.com","Attempting Contact"],
  ["naenae76@naver.com","Attempting Contact"],
  ["ji92710@naver.com","Attempting Contact"],
  ["rlawldus0806@gmail.com","Attempting Contact"],
  ["yoonsunl@gmail.com","Attempting Contact"],
  ["eyko813@gmail.com","Attempting Contact"],
  ["sang.s200905@gge.goe.go.kr","Attempting Contact"],
  ["wjsgpqls234@gmail.com","Attempting Contact"],
  ["khulanhuuk@gmail.com","Attempting Contact"],
  ["sonnysaimonac@gmail.com","Attempting Contact"],
  ["missican0801@gmail.com","Attempting Contact"],
  ["layla.xovl@gamil.com","Attempting Contact"],
  ["doobee7@naver.com","Contacted"],
  ["eunjeongcho1203@gmail.com","Contacted"],
  ["suphia78@gmail.com","Contacted"],
  ["2650542062@qq.com","Contacted"],
  ["iwonpark@gmail.com","Contacted"],
  ["scarlettekim9730@gmail.com","Contacted"],
  ["myeonghwai928@gmail.com","Contacted"],
  ["banana7603@naver.com","Contacted"],
  ["dbckdgh@gmail.com","Contacted"],
  ["robert0419@naver.com","Contacted"],
  ["acejulu@naver.com","Contacted"],
  ["junsuklee78@gmail.com","Contacted"],
  ["b01055930110@gmail.com","Contacted"],
  ["meiai061@naver.com","Contacted"],
  ["haejin1018@naver.com","Contacted"],
  ["servantlee@gmail.com","Contacted"],
  ["gosilver80@naver.com","Disqualified"],
  ["jawon.koo.85@gmail.com","Disqualified"],
  ["changwonjoung@gmail.com","Disqualified"],
  ["koohani03@gmail.com","Disqualified"],
  ["ph_love@naver.com","Disqualified"],
  ["lhm21c@hotmail.com","Disqualified"],
  ["skysam0212@gmail.com","Disqualified"],
  ["vangna79@gmail.com","Disqualified"],
  ["iyj12447@naver.com","Disqualified"],
  ["sksjsh@gmail.com","Disqualified"],
  ["yooseoyeong11@kakao.com","Disqualified"],
  ["suoy0903@naver.com","Disqualified"],
  ["ooppss78@naver.com","Disqualified"],
  ["jfolio@naver.com","Disqualified"],
  ["urruraki@gmail.com","Disqualified"],
  ["a39750351010@gmail.com","Disqualified"],
  ["ianponcholuv@gmail.com","Disqualified"],
  ["lee.eunhye.yul@gmail.com","Disqualified"],
  ["streamingsuljab@gmail.com","Disqualified"],
  ["opvs73@naver.com","Disqualified"],
  ["plum818181@gmail.com","Disqualified"],
  ["hhh8019@naver.com","Disqualified"],
  ["eunji5326@hanmail.net","Disqualified"],
  ["yunyel0817@naver.com","Disqualified"],
  ["kim861017@naver.com","Disqualified"],
  ["jooyoonseo07@gmail.com","Disqualified"],
  ["beautybjn@naver.com","Disqualified"],
  ["szoxona1267@gmail.com","Disqualified"],
  ["jieun24jenny@gmail.com","Disqualified"],
  ["9binial9@gmail.com","Disqualified"],
  ["tnwjdonl@gmail.com","Disqualified"],
  ["h2s37hc@gmail.com","Disqualified"],
  ["jenny-art@naver.com","Disqualified"],
  ["photobeat1@naver.com","Disqualified"],
  ["hyein2642722@gmail.com","Disqualified"],
  ["1024sf@daum.net","Disqualified"],
  ["yangsheep2024@gmail.com","Disqualified"],
  ["shin102973@gmail.com","Disqualified"],
  ["jeonyena10@naver.com","Disqualified"],
  ["tsar11skosk@gmail.com","Disqualified"],
  ["ci9865821@gmail.com","Disqualified"],
  ["jounelina08@gmail.com","Disqualified"],
  ["lehwabin0011@gmail.com","Disqualified"],
  ["a32851617@gmail.com","Disqualified"],
  ["jenney6225@gmail.com","Disqualified"],
  ["wlsgur7831@naver.com","Disqualified"],
  ["a01080217699@gmail.com","Disqualified"],
  ["csm.5649@gmail.com","Disqualified"],
  ["kinetiroom@gmail.com","Disqualified"],
  ["leejiwoo0910@gmail.com","Disqualified"],
  ["minjubae466@gmail.com","Disqualified"],
  ["heodayeong187@gmail.com","Disqualified"],
  ["isabelle0928h@gmail.com","Disqualified"],
  ["suin2406@naver.com","Disqualified"],
  ["kimhyomin0627@gmail.com","Disqualified"],
  ["yesrin12@gmail.com","Disqualified"],
  ["mingyeongbyeon143@gmail.com","Disqualified"],
  ["mrhans0128@gmail.com","Disqualified"],
  ["kimsy_0807@naver.com","Disqualified"],
  ["hyosungkim0208@gmail.com","Disqualified"],
  ["minsolg149@gmail.com","Disqualified"],
  ["iscaveo@gmail.com","Disqualified"],
  ["rjdalswhd7890@gmail.com","Disqualified"],
  ["jh.shin0802@icloud.com","Disqualified"],
  ["jeonyj0001@gmail.com","Disqualified"],
  ["wj3990@naver.com","Disqualified"],
  ["kmj09183@gmail.com","Disqualified"],
  ["jamongade7@naver.com","Disqualified"],
  ["jooah100402@naver.com","Disqualified"],
  ["vonsehwan@gmail.com","Disqualified"],
  ["si9408303@gmail.com","Disqualified"],
  ["yujuamry0613@naver.com","Disqualified"],
  ["byeonjaegwan3@gmail.com","Disqualified"],
  ["jungsangwoon93@gmail.com","Disqualified"],
  ["ming0102123@gmail.com","Disqualified"],
  ["2youngmin08@gmail.com","Disqualified"],
  ["selixzuq1664@gmail.com","Disqualified"],
  ["hamcy0624@gmail.com","Disqualified"],
  ["hagyun0829@gmail.com","Disqualified"],
  ["minz200905@gmail.com","Disqualified"],
  ["dongilgim113@gmail.com","Disqualified"],
  ["acts799100@gmail.com","Disqualified"],
  ["ohajun143@gmail.com","Disqualified"],
  ["leejumi2411@gmail.com","Disqualified"],
  ["01nxij@gmail.com","Disqualified"],
  ["hoho3813@naver.com","Disqualified"],
  ["0824sayun@gmail.com","Disqualified"],
  ["pupu4801@naver.com","Disqualified"],
  ["halynn8326@gmail.com","Disqualified"],
  ["toys797979@naver.com","Disqualified"],
  ["ysh880707@gmail.com","Disqualified"],
  ["gajami2662@gmail.com","Disqualified"],
  ["xodil78896@umeifun.com","Disqualified"],
  ["buok0310@gmail.com","Disqualified"],
  ["kgy071008@naver.com","Disqualified"],
  ["sdonghwans@gmail.com","Disqualified"],
  ["sangwoon93@naver.com","Disqualified"],
  ["haengjin_lee@naver.com","Disqualified"],
  ["dowon9287@gmail.com","Disqualified"],
  ["andud331@naver.com","Disqualified"],
  ["0weol2m@gmail.com","Disqualified"],
  ["yebongang0@gmail.com","Disqualified"],
  ["ui889945@gmail.com","Disqualified"],
  ["shalara75@gmail.com","Disqualified"],
  ["yhy2411@naver.com","Disqualified"],
  ["mblks@naver.com","Disqualified"],
  ["shawneom@naver.com","Disqualified"],
  ["leechanbi00@gmail.com","Disqualified"],
  ["jasd.usolp_s@icloud.com","Disqualified"],
  ["jk0129.kim@samsung.com","Disqualified"],
  ["mhs0515@naver.com","Disqualified"],
  ["chayurim0724@naver.com","Disqualified"],
  ["melissayasa84@gmail.com","Disqualified"],
  ["sonjihyeog88@gmail.com","Disqualified"],
  ["tjcbrian@gmail.com","Disqualified"],
  ["a01053174356@gmail.com","Disqualified"],
  ["mwcxae0128@gmail.com","Disqualified"],
  ["bungabunga060108@gmail.com","Disqualified"],
  ["loveahh@daum.net","Disqualified"],
  ["glory530@paran.com","Disqualified"],
  ["a96062837@gmail.com","Disqualified"],
  ["lhtsjrhrh@gmail.com","Disqualified"],
  ["sosacucumber@naver.com","Disqualified"],
  ["wings24011128@gmail.com","Disqualified"],
  ["symin1117@gmail.com","Disqualified"],
  ["hyeryeon2548@gmail.com","Disqualified"],
  ["snfl09@icloud.com","Disqualified"],
  ["poison9508@naver.com","Disqualified"],
  ["t8694884@gmail.com","Disqualified"],
  ["hgim42943@gmail.com","Disqualified"],
  ["ihyeonjeong816@gmail.com","Disqualified"],
  ["ychk49@gmail.com","Disqualified"],
  ["meirong3656@naver.com","Disqualified"],
  ["ohjiwoo3484@naver.com","Disqualified"],
  ["yoosujin1218@gmail.com","Disqualified"],
  ["scissam@naver.com","Disqualified"],
  ["su3ha5@hanmail.net","Disqualified"],
  ["youngjin120828@gmail.com","Disqualified"],
  ["jh.kim@cnjchem.net","Disqualified"],
  ["hongjin1227@nate.com","Disqualified"],
  ["hediyenasirii86@gmail.com","Disqualified"],
  ["goodfly830@gmail.com","Disqualified"],
  ["agoodfool1104@gmail.com","Disqualified"],
  ["bj7887@naver.com","Disqualified"],
  ["swoosmile@gmail.com","Disqualified"],
  ["lovetrain0917@gmail.com","Disqualified"],
  ["a01082351784@gmail.com","Disqualified"],
  ["joontae7064@gmail.com","Disqualified"],
  ["hanmingyun321@gmail.com","Disqualified"],
  ["kudanwoo11@gmail.com","Disqualified"],
  ["0810kye@gmail.com","Disqualified"],
  ["sophia2012820@gmail.com","Disqualified"],
  ["jung970500@gmail.com","Disqualified"],
  ["nambonox2@gmail.com","Disqualified"],
  ["a01045268378@gmail.com","Disqualified"],
  ["xiawenqigege@163.com","Disqualified"],
  ["jsunny1012@naver.com","IC Booked"],
  ["ssong508@gmail.com","IC Booked"],
  ["erin0582@gmail.com","IC Booked"],
  ["psjhkb@naver.com","IC Booked"],
  ["julia.cheon@yahoo.com","IC Booked"],
  ["jeun_young@naver.com","IC Booked"],
  ["mini37510@naver.com","IC Booked"],
  ["mpilaniwala@gmail.com","IC Booked"],
  ["inigahn@gmail.com","IC Booked"],
  ["mdleebs@gmail.com","IC Booked"],
  ["vn79young@hanmail.net","IC Booked"],
  ["lsuny98@gmail.com","IC Booked"],
  ["cyr.vtr@gmail.com","IC Booked"],
  ["joohi82@naver.com","IC Booked"],
  ["sung.pyun@speclipse.com","IC Booked"],
  ["heisyou@gmail.com","IC Booked"],
  ["k29870950@gmail.com","IC Booked"],
  ["sunife@hotmail.com","IC Booked"],
  ["freechal00@naver.com","IC Booked"],
  ["netykim9797@naver.com","IC Booked"],
  ["jisugy@naver.com","IC Booked"],
  ["jackiek75@gmail.com","Qualified"],
  ["wooooow79@naver.com","Qualified"],
  ["giyoun_lee@naver.com","Qualified"],
  ["tgyoush@gmail.com","Qualified"],
  ["jeeyoon79@naver.com","Qualified"],
  ["avecmgr@gmail.com","Qualified"],
  ["happysahngmi@gmail.com","Qualified"],
  ["jinhee.jang@gmail.com","Qualified"],
  ["micyoo@gmail.com","Qualified"],
  ["pchanmi.ad@gmail.com","Qualified"],
  ["whereur10@gmail.com","Qualified"],
  ["tabbyy77@gmail.com","Qualified"],
  ["ssy003@gmail.com","Qualified"],
  ["lyj79bada@gmail.com","Qualified"],
  ["samchuchu89@gmail.com","Qualified"],
  ["help@tonny.net","Qualified"],
  ["dugong0907@gmail.com","Qualified"],
  ["gracebbcjin@gmail.com","Qualified"],
  ["songcm2027@tciscommunity.com","Qualified"],
  ["ian.han0408@gmail.com","Qualified"],
  ["washgoo@gmail.com","Qualified"],
  ["ands82@naver.com","Qualified"],
  ["i.m.dasom@gmail.com","Qualified"],
  ["rrxaun@gmail.com","Qualified"],
  ["luciajuly77@gmail.com","Qualified"],
  ["eun_ji_kim@bat.com","Qualified"],
  ["ywsahn@gmail.com","Qualified"],
  ["li36682@gmail.com","Qualified"],
  ["choi.jongsok@gmail.com","Qualified"],
  ["chiwupark@gmail.com","Qualified"],
  ["bgfnccoo@gmail.com","Qualified"],
  ["redrock333@yahoo.com","Qualified"],
  ["luciajuly77@gmail.co","Qualified"]
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);
  const headerMap = getHeaderMap(opsSheet);

  const emailCol = headerMap["Email"];
  const salCol = headerMap["Sales Accepted Date"];
  const lastRow = opsSheet.getLastRow();

  const opsByEmail = {};

  if(lastRow >= OPS.ROWS.DATA_START){
    const numRows = lastRow - OPS.ROWS.DATA_START + 1;
    const emailValues = opsSheet.getRange(OPS.ROWS.DATA_START, emailCol + 1, numRows, 1).getValues();
    const salValues = opsSheet.getRange(OPS.ROWS.DATA_START, salCol + 1, numRows, 1).getValues();

    emailValues.forEach(function(row, i){
      const email = String(row[0] || "").trim().toLowerCase();
      if(!email) return;
      opsByEmail[email] = salValues[i][0];
    });
  }

  let notFoundInOPS = 0;
  let foundButNoSAL = 0;
  let foundButWrongMonth = 0;
  let matched = 0;

  const notFoundList = [];
  const staleList = [];

  SALESFORCE_SAL_AUGUST.forEach(function(pair){

    const email = pair[0].trim().toLowerCase();
    const status = pair[1];

    if(!(email in opsByEmail)){
      notFoundInOPS++;
      notFoundList.push(email + " (" + status + ")");
      return;
    }

    const salValue = opsByEmail[email];

    if(!(salValue instanceof Date) || isNaN(salValue.getTime())){
      foundButNoSAL++;
      staleList.push(email + " (" + status + ") : Sales Accepted Date 비어있음");
      return;
    }

    const fy = Number(getFiscalYear(salValue).replace("FY", ""));
    const month = getFiscalMonthLabel(salValue);

    if(fy !== TARGET_FY || month !== TARGET_MONTH){
      foundButWrongMonth++;
      staleList.push(
        email + " (" + status + ") : Sales Accepted Date=" +
        Utilities.formatDate(salValue, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd") + " (8월 아님)"
      );
      return;
    }

    matched++;

  });

  Logger.log("========== FY27 AUG SAL 대조 (Salesforce " + SALESFORCE_SAL_AUGUST.length + "건) ==========");
  Logger.log("정상 일치(Sales Accepted Date=8월)     : " + matched);
  Logger.log("Leads_OPS에 없음(Email 매칭 실패)      : " + notFoundInOPS);
  Logger.log("Leads_OPS엔 있으나 Sales Accepted Date 없음 : " + foundButNoSAL);
  Logger.log("Leads_OPS엔 있으나 다른 달로 찍힘        : " + foundButWrongMonth);
  Logger.log("");
  Logger.log("---- Leads_OPS에 없는 " + notFoundList.length + "건 ----");
  notFoundList.forEach(function(line){ Logger.log("  - " + line); });
  Logger.log("");
  Logger.log("---- 있지만 Sales Accepted Date가 8월이 아니거나 비어있는 " + staleList.length + "건 ----");
  staleList.forEach(function(line){ Logger.log("  - " + line); });

}
