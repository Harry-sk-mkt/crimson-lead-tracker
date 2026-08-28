/**
 * ==========================================================
 * Marketing 2.0
 * Temp QA — 8월 New P1(279) vs ACQ_REP(267) 리드 단위 대조
 * (docs/OpenItems.md #32 후속 조사, 사용자가 제공한 Salesforce
 * "New Leads" 리포트 CSV 전체 739건 기준)
 *
 * Responsibility
 * TEMPQA_036 실측 결과, New P1은 화면(267)과 원본 재계산이 정확히
 * 일치해 캐시 지연이 아니라 진짜 데이터 갭으로 확인됨. 사용자가 제공한
 * Salesforce 8월 New Leads 리포트(전체 739건, 그중 Lead Priority=
 * "Priority 1"인 건 279건 — 사용자가 말한 기대값과 정확히 일치)를
 * Leads_Master/Leads_OPS와 Lead ID 단위로 1:1 대조해 12건 갭의 정확한
 * 원인을 좁힌다(#20/#27/#32와 동일한 방법론).
 *
 * 분류:
 * (1) Leads_Master에도 없음 — Import 공백
 * (2) Leads_Master엔 있는데 Leads_OPS엔 없음 — mergeOPS() earliest-wins
 *     로 배제(#20 redrock333/#27 케이스와 동일 패턴 가능성)
 * (3) 둘 다 있음, Salesforce=Priority 1인데 Leads_Master/Leads_OPS의
 *     Lead Priority가 다름 — Priority 값 자체가 우리 쪽에 최신 반영
 *     안 된 것(스냅샷 지연)
 * (4) 둘 다 있고 Priority도 "Priority 1"로 같은데 isEffectiveP1_()이
 *     false — Priority Override가 걸려있어서 억제된 경우
 * (5) 정상 일치
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 *
 * INPUT: 없음 (Leads_Master/Leads_OPS 직접 스캔, Salesforce 목록은
 *   사용자가 제공한 CSV에서 채굴해 하드코딩)
 * OUTPUT: Logger.log만
 *
 * TEST: 별도 testXXXX() 없음 — 1회성 실데이터 조사 스크립트(TEMPQA 관례).
 *
 * Version
 * v1.1.0
 *
 * Change Log
 * v1.1.0 (2026-08-28)
 * - runCompareAugustNewP1AgainstSalesforce() 1차 실행 결과, priorityStaleAtMaster
 *   10건이 갭의 대부분을 차지함 확인 — 사용자가 "MTA_Master에도 최신 Priority가
 *   없는지" 질문, runTraceStalePriorityLeadsInMTA() 신규 추가(해당 10건을
 *   MTA_Master에서 직접 조회해 터치 존재 여부/최근 터치일/Lead Priority 값 덤프).
 * v1.0.0 (2026-08-28)
 * - 최초 구현.
 * ==========================================================
 */
function runCompareAugustNewP1AgainstSalesforce(){

  // [Lead ID, Email, Salesforce Lead Priority, Create Date(day-first)]
  const SALESFORCE_NEW_LEADS = [
    ["00QRC00001JWdNl","rrxaun@gmail.com","","3/8/2026"],
    ["00QRC00001JL9sr","robert0419@naver.com","Priority 1","1/8/2026"],
    ["00QRC00001KLGvN","jhee6420@naver.com","Priority 1","6/8/2026"],
    ["00QRC00001JJF37","ys05073@gmail.com","Priority 1","1/8/2026"],
    ["00QRC00001JMIyv","cyr.vtr@gmail.com","Priority 1","1/8/2026"],
    ["00QRC00001JMOkz","plum818181@gmail.com","Priority 1","1/8/2026"],
    ["00QRC00001JMSAH","eunn18@naver.com","Priority 1","1/8/2026"],
    ["00QRC00001JOLe9","envy67@nate.com","Priority 1","2/8/2026"],
    ["00QRC00001JPF21","joy7796@naver.com","Priority 1","2/8/2026"],
    ["00QRC00001JPKRV","comiturkey@gmail.com","Priority 1","2/8/2026"],
    ["00QRC00001JPQK1","jiyooon0@gmail.com","Priority 1","2/8/2026"],
    ["00QRC00001JPjeP","yik722@naver.com","Priority 1","2/8/2026"],
    ["00QRC00001JQMmE","ssslala1077@gmail.com","Priority 1","2/8/2026"],
    ["00QRC00001JQVZN","sharryy@naver.com","Priority 1","2/8/2026"],
    ["00QRC00001JRRrt","artnsci08@gmail.com","Priority 1","2/8/2026"],
    ["00QRC00001JRgAz","ymjang7@gmail.com","Priority 1","2/8/2026"],
    ["00QRC00001JRnIw","jihyeonmpark@gmail.com","Priority 1","3/8/2026"],
    ["00QRC00001JSF77","lerio@naver.com","Priority 1","3/8/2026"],
    ["00QRC00001JSOLh","hoon7710@hotmail.com","Priority 1","3/8/2026"],
    ["00QRC00001JTNAf","waiceo1107@gmail.com","Priority 1","3/8/2026"],
    ["00QRC00001JXZtB","jooyoonseo07@gmail.com","Priority 1","3/8/2026"],
    ["00QRC00001JYOVt","kangmj265@gmail.com","Priority 1","3/8/2026"],
    ["00QRC00001JYdWX","email629@naver.com","Priority 1","3/8/2026"],
    ["00QRC00001JYkg5","szoxona1267@gmail.com","Priority 1","3/8/2026"],
    ["00QRC00001JauQ3","kyungjo31@gmail.com","Priority 1","4/8/2026"],
    ["00QRC00001JbovF","dearluv80@hotmail.com","Priority 1","4/8/2026"],
    ["00QRC00001JbpCz","jiyeajeong@gmail.com","Priority 1","4/8/2026"],
    ["00QRC00001JciKl","wonah531@naver.com","Priority 1","4/8/2026"],
    ["00QRC00001JdoXl","via.hayulkim1001@gmail.com","Priority 1","4/8/2026"],
    ["00QRC00001JgHc5","yoonjin79@gmail.com","Priority 1","4/8/2026"],
    ["00QRC00001JhsbB","bjk2821004@naver.com","Priority 1","4/8/2026"],
    ["00QRC00001JgiKY","jihyunlim017@gmail.com","Priority 1","4/8/2026"],
    ["00QRC00001K1laL","senti-01@hanmail.net","Priority 1","5/8/2026"],
    ["00QRC00001K76vt","lishsuns78@gmail.com","Priority 1","5/8/2026"],
    ["00QRC00001K4aTu","leejuyujumom@naver.com","Priority 1","5/8/2026"],
    ["00QRC00001KA88L","sslee76@naver.com","Priority 1","5/8/2026"],
    ["00QRC00001KDF21","yrimlee7@gmail.com","Priority 1","5/8/2026"],
    ["00QRC00001KGIkv","uijubae@gmail.com","Priority 1","5/8/2026"],
    ["00QRC00001KHnpt","hkim22@farragut2.org","Priority 1","6/8/2026"],
    ["00QRC00001KIV2v","armipolaris@gmail.com","Priority 1","6/8/2026"],
    ["00QRC00001KISgB","0537juan@naver.com","Priority 1","6/8/2026"],
    ["00QRC00001KIzgw","grace.m.hong@gmail.com","Priority 1","6/8/2026"],
    ["00QRC00001KJgU9","nespoir@naver.com","Priority 1","6/8/2026"],
    ["00QRC00001KJhGX","inanna9@hanmail.net","Priority 1","6/8/2026"],
    ["00QRC00001KJpNl","hyunjungjang@hotmail.com","Priority 1","6/8/2026"],
    ["00QRC00001KLWX7","hms917k@gmail.com","Priority 1","6/8/2026"],
    ["00QRC00001KNs3h","jihkim7575@naver.com","Priority 1","6/8/2026"],
    ["00QRC00001KQ6Va","terikim08@gmail.com","Priority 1","7/8/2026"],
    ["00QRC00001KQzqD","sunrise.shine2020@gmail.com","Priority 1","7/8/2026"],
    ["00QRC00001KSTMP","guapa1979@naver.com","Priority 1","7/8/2026"],
    ["00QRC00001KTmLN","myfairy82@gmail.com","Priority 1","7/8/2026"],
    ["00QRC00001KV54D","lucas.jung8030@gmail.com","Priority 1","7/8/2026"],
    ["00QRC00001KVoKf","polo709@naver.com","Priority 1","7/8/2026"],
    ["00QRC00001KXeHC","lhsvision@naver.com","Priority 1","7/8/2026"],
    ["00QRC00001KZU5d","ellensuh32@gmail.com","Priority 1","8/8/2026"],
    ["00QRC00001KaOz3","hyojunan2009@gmail.com","Priority 1","8/8/2026"],
    ["00QRC00001KbCEH","read101sam2@naver.com","Priority 1","8/8/2026"],
    ["00QRC00001KcUDx","airanghanaro@gmail.com","Priority 1","8/8/2026"],
    ["00QRC00001Kd1Q4","dudwno@gmail.com","Priority 1","8/8/2026"],
    ["00QRC00001Kdqyq","jjkop25@gmail.com","Priority 1","9/8/2026"],
    ["00QRC00001KeWI5","cscarlet1077@gmail.com","Priority 1","9/8/2026"],
    ["00QRC00001KfNaw","junny1219@naver.com","Priority 1","9/8/2026"],
    ["00QRC00001Kff1Z","rainy52@gmail.com","Priority 1","9/8/2026"],
    ["00QRC00001KfBV0","jinsm0725@gmail.com","Priority 1","9/8/2026"],
    ["00QRC00001Kgm4E","kinetiroom@gmail.com","Priority 1","9/8/2026"],
    ["00QRC00001Kgrwk","jenkim1116@gmail.com","Priority 1","9/8/2026"],
    ["00QRC00001KhYgj","xyps@naver.com","Priority 1","9/8/2026"],
    ["00QRC00001KhWiA","acejulu@naver.com","Priority 1","10/8/2026"],
    ["00QRC00001Ki1m0","ryankwak08@gmail.com","Priority 1","10/8/2026"],
    ["00QRC00001KiHUA","odenggoindia@gmail.com","Priority 1","10/8/2026"],
    ["00QRC00001KiXp4","park.ilhwi@gmail.com","Priority 1","10/8/2026"],
    ["00QRC00001KjOTZ","jin4468@gmail.com","Priority 1","10/8/2026"],
    ["00QRC00001KjrVa","hyeweon95@gmail.com","Priority 1","10/8/2026"],
    ["00QRC00001KkgWW","js.ahn77@gmail.com","Priority 1","10/8/2026"],
    ["00QRC00001KlKDw","tjsrud1452@msn.com","Priority 1","10/8/2026"],
    ["00QRC00001KmMVF","jiyu8584@gmail.com","Priority 1","10/8/2026"],
    ["00QRC00001Kmqxx","sij2010@nate.com","Priority 1","10/8/2026"],
    ["00QRC00001KnGdt","soiyoon921@gmail.com","Priority 1","10/8/2026"],
    ["00QRC00001KnyOn","parksj9141@gmail.com","Priority 1","10/8/2026"],
    ["00QRC00001KoEF3","sunmie.yoo@gmail.com","Priority 1","11/8/2026"],
    ["00QRC00001KpCKr","jmoonsunstar@gmail.com","Priority 1","11/8/2026"],
    ["00QRC00001Kpnlp","odongee81@gmail.com","Priority 1","11/8/2026"],
    ["00QRC00001KqGKn","vuddks76@hanmail.net","Priority 1","11/8/2026"],
    ["00QRC00001KqQVR","jhpark799@naver.com","Priority 1","11/8/2026"],
    ["00QRC00001KqJsA","groovytheofficial@gmail.com","Priority 1","11/8/2026"],
    ["00QRC00001Krphv","hyejin0401@naver.com","Priority 1","11/8/2026"],
    ["00QRC00001KsiRR","jiy.shin@gmail.com","Priority 1","11/8/2026"],
    ["00QRC00001Kta6s","unico1128@gmail.com","Priority 1","11/8/2026"],
    ["00QRC00001KuBG6","musique9@gmail.com","Priority 1","12/8/2026"],
    ["00QRC00001KvHmT","umjee3@gmail.com","Priority 1","12/8/2026"],
    ["00QRC00001KvQEl","vcrystal@daum.net","Priority 1","12/8/2026"],
    ["00QRC00001Kvbrd","heimint0322@gmail.com","Priority 1","12/8/2026"],
    ["00QRC00001KwB2H","kwanghk1@naver.com","Priority 1","12/8/2026"],
    ["00QRC00001KwJHZ","joshuajkpark@gmail.com","Priority 1","12/8/2026"],
    ["00QRC00001KwJW5","andreasgarden25@gmail.com","Priority 1","12/8/2026"],
    ["00QRC00001Kzt3Z","sais7942@gmail.com","Priority 1","12/8/2026"],
    ["00QRC00001L01h4","ccwjyk@gmail.com","Priority 1","13/8/2026"],
    ["00QRC00001L1Inv","noahkim@naver.com","Priority 1","13/8/2026"],
    ["00QRC00001L1ReH","twentyooo8@gmail.com","Priority 1","13/8/2026"],
    ["00QRC00001L2YsD","snjhjwon@naver.com","Priority 1","13/8/2026"],
    ["00QRC00001L2VHe","9607002@gmail.com","Priority 1","13/8/2026"],
    ["00QRC00001L3Vdl","jeun0291@gmail.com","Priority 1","13/8/2026"],
    ["00QRC00001L2mqO","yowlhwahan@gmail.com","Priority 1","13/8/2026"],
    ["00QRC00001L4eAL","kyrmail@naver.com","Priority 1","13/8/2026"],
    ["00QRC00001L5QBl","lbhsponge@gmail.com","Priority 1","13/8/2026"],
    ["00QRC00001L4WHf","inseohyun@gmail.com","Priority 1","13/8/2026"],
    ["00QRC00001L5qZF","swn12@naver.com","Priority 1","13/8/2026"],
    ["00QRC00001L6I0r","snowdrop0302@naver.com","Priority 1","13/8/2026"],
    ["00QRC00001L6KNd","suiwhite@naver.com","Priority 1","13/8/2026"],
    ["00QRC00001L6BST","leesulhi@naver.com","Priority 1","13/8/2026"],
    ["00QRC00001L72Gb","hwangsaewon511@gmail.com","Priority 1","14/8/2026"],
    ["00QRC00001L73MN","jeun0291@naver.com","Priority 1","14/8/2026"],
    ["00QRC00001L7iNt","yoonhwakim83@gmail.com","Priority 1","14/8/2026"],
    ["00QRC00001L84Ja","chaewonjung49@naver.com","Priority 1","14/8/2026"],
    ["00QRC00001L8ud7","yeongmin.you@gmail.com","Priority 1","14/8/2026"],
    ["00QRC00001LBF0k","jenny8312@naver.com","Priority 1","14/8/2026"],
    ["00QRC00001LCSbq","kihwalim@gmail.com","Priority 1","14/8/2026"],
    ["00QRC00001LCxxN","jal2@hanmir.com","Priority 1","15/8/2026"],
    ["00QRC00001LCraE","kyung.sakong@gmail.com","Priority 1","15/8/2026"],
    ["00QRC00001LEZqv","olivia.project33@gmail.com","Priority 1","15/8/2026"],
    ["00QRC00001LGnpl","changhyukjin@naver.com","Priority 1","15/8/2026"],
    ["00QRC00001LGS0Z","dbtnfla85@naver.com","Priority 1","16/8/2026"],
    ["00QRC00001LHDnT","sophiagracebek@gmail.com","Priority 1","16/8/2026"],
    ["00QRC00001LHQ4n","wittyshy@gmail.com","Priority 1","16/8/2026"],
    ["00QRC00001LHRLl","wndduf2@naver.com","Priority 1","16/8/2026"],
    ["00QRC00001LHvGb","jyinseoul@gmail.com","Priority 1","16/8/2026"],
    ["00QRC00001LHjc2","dksthfwl99@gmail.com","Priority 1","16/8/2026"],
    ["00QRC00001LIr2r","sss39092@gmail.com","Priority 1","16/8/2026"],
    ["00QRC00001LJ8Zx","zany4600@naver.com","Priority 1","16/8/2026"],
    ["00QRC00001LJT9l","kofia00@naver.com","Priority 1","16/8/2026"],
    ["00QRC00001LJLAc","kissy10@naver.com","Priority 1","16/8/2026"],
    ["00QRC00001LJga2","byeolhahwang6@gmail.com","Priority 1","16/8/2026"],
    ["00QRC00001LJoPV","mpblim79@gmail.com","Priority 1","16/8/2026"],
    ["00QRC00001LJJX1","jyjdbs94@naver.com","Priority 1","16/8/2026"],
    ["00QRC00001LK4dx","yonghee79@gmail.com","Priority 1","16/8/2026"],
    ["00QRC00001LKLba","flsfl@naver.com","Priority 1","17/8/2026"],
    ["00QRC00001LKZkz","seunglims@gmail.com","Priority 1","17/8/2026"],
    ["00QRC00001LKzUA","lukeny@gmail.com","Priority 1","17/8/2026"],
    ["00QRC00001LMiAf","hyhkjy2@gmail.com","Priority 1","17/8/2026"],
    ["00QRC00001LMmnm","eht8282@gmail.com","Priority 1","17/8/2026"],
    ["00QRC00001LNBZF","ebbnej@gmail.com","Priority 1","17/8/2026"],
    ["00QRC00001LOgL2","elok0522@msn.com","Priority 1","17/8/2026"],
    ["00QRC00001LNsJH","ceo@lyaxome.co.kr","Priority 1","17/8/2026"],
    ["00QRC00001LPt6M","eunoh1107kangin@gmail.com","Priority 1","17/8/2026"],
    ["00QRC00001LR4R8","minelily@gmail.com","Priority 1","17/8/2026"],
    ["00QRC00001LRwtC","jooene@gmail.com","Priority 1","18/8/2026"],
    ["00QRC00001LS3Ud","andygoldkim@gmail.com","Priority 1","18/8/2026"],
    ["00QRC00001LSj7F","ksyclub5215@naver.com","Priority 1","18/8/2026"],
    ["00QRC00001LTqEj","laurenbk.choi@gmail.com","Priority 1","18/8/2026"],
    ["00QRC00001LUpZx","lieve82@naver.com","Priority 1","18/8/2026"],
    ["00QRC00001LUpDO","grandgourmet@naver.com","Priority 1","18/8/2026"],
    ["00QRC00001LYYQr","minelily@naver.com","Priority 1","18/8/2026"],
    ["00QRC00001LYkbh","newjml@naver.com","Priority 1","18/8/2026"],
    ["00QRC00001LYshM","3138moon@gmail.com","Priority 1","18/8/2026"],
    ["00QRC00001Lai4L","talk2hjk@naver.com","Priority 1","19/8/2026"],
    ["00QRC00001Lb591","lmh780802@gmail.com","Priority 1","19/8/2026"],
    ["00QRC00001LcP41","sophiawnoah@gmail.com","Priority 1","19/8/2026"],
    ["00QRC00001LchNW","mjparkelly@gmail.com","Priority 1","19/8/2026"],
    ["00QRC00001LdrG3","jimin0326@gmail.com","Priority 1","19/8/2026"],
    ["00QRC00001LfcO5","yeonho1101kang@gmail.com","Priority 1","19/8/2026"],
    ["00QRC00001LgAO9","wide75@naver.com","Priority 1","19/8/2026"],
    ["00QRC00001LhDGj","hyekyung1210@gmail.com","Priority 1","19/8/2026"],
    ["00QRC00001LheFJ","strut@lumpens.com","Priority 1","19/8/2026"],
    ["00QRC00001LiHes","myyami@gmail.com","Priority 1","19/8/2026"],
    ["00QRC00001Liddm","lena@yuwonedu.com","Priority 1","20/8/2026"],
    ["00QRC00001LkXvd","fizzer01@naver.com","Priority 1","20/8/2026"],
    ["00QRC00001LkoJl","mickeyillumination@gmail.com","Priority 1","20/8/2026"],
    ["00QRC00001LkCHj","carac95@gmail.com","Priority 1","20/8/2026"],
    ["00QRC00001Lls6n","mblks@naver.com","Priority 1","20/8/2026"],
    ["00QRC00001LnNri","wk8100@naver.com","Priority 1","20/8/2026"],
    ["00QRC00001LowfJ","parkheejo0626@gmail.com","Priority 1","20/8/2026"],
    ["00QRC00001LrFxB","chloechovi@gmail.com","Priority 1","21/8/2026"],
    ["00QRC00001Lrwqs","lacuss@hotmail.com","Priority 1","21/8/2026"],
    ["00QRC00001LthJ3","ddxjj@hanmail.net","Priority 1","21/8/2026"],
    ["00QRC00001LuJZe","tjdwnahepf@naver.com","Priority 1","21/8/2026"],
    ["00QRC00001LyUcv","hhy810202@hotmail.com","Priority 1","21/8/2026"],
    ["00QRC00001LyeZ3","kyungmj87@gmail.com","Priority 1","21/8/2026"],
    ["00QRC00001LyiZR","beingsospecial@gmail.com","Priority 1","21/8/2026"],
    ["00QRC00001LzevB","chaeeunpark0124@gmail.com","Priority 1","22/8/2026"],
    ["00QRC00001LzndV","hello.anne.chung@gmail.com","Priority 1","22/8/2026"],
    ["00QRC00001M0fZ3","hyunyeelee@gmail.com","Priority 1","22/8/2026"],
    ["00QRC00001M0yDW","kikiindia@naver.com","Priority 1","22/8/2026"],
    ["00QRC00001M17a9","wwjd0322@hotmail.com","Priority 1","22/8/2026"],
    ["00QRC00001M1L21","pppp8212@gmail.com","Priority 1","22/8/2026"],
    ["00QRC00001M1VmA","senabae79s@gmail.com","Priority 1","22/8/2026"],
    ["00QRC00001M1hKH","maggot.summons3m@icloud.com","Priority 1","22/8/2026"],
    ["00QRC00001M1fX0","jinijooho@gmail.com","Priority 1","22/8/2026"],
    ["00QRC00001M2CPh","cspc@naver.com","Priority 1","22/8/2026"],
    ["00QRC00001M1qLy","dabi1126@hanmail.net","Priority 1","22/8/2026"],
    ["00QRC00001M1xdb","abakua@naver.com","Priority 1","22/8/2026"],
    ["00QRC00001M2LuP","moma918@gmail.com","Priority 1","22/8/2026"],
    ["00QRC00001M1o0s","marivaux77@naver.com","Priority 1","22/8/2026"],
    ["00QRC00001M29IC","1.1yeony19@gmail.com","Priority 1","22/8/2026"],
    ["00QRC00001M2wig","socialplanner@gmail.com","Priority 1","22/8/2026"],
    ["00QRC00001M4VUf","bluequeen0@naver.com","Priority 1","23/8/2026"],
    ["00QRC00001M5IOv","h7039975@empal.com","Priority 1","23/8/2026"],
    ["00QRC00001M5bL7","hitehyunji@naver.com","Priority 1","23/8/2026"],
    ["00QRC00001M62DG","mkworldy@gmail.com","Priority 1","23/8/2026"],
    ["00QRC00001M6TJt","qkr.dls07@gmail.com","Priority 1","23/8/2026"],
    ["00QRC00001M6nYj","chandramohanr80@gmail.com","Priority 1","23/8/2026"],
    ["00QRC00001M7GCX","kkpearl0517@gmail.com","Priority 1","23/8/2026"],
    ["00QRC00001M8Ly9","kimlinda0404@gmail.com","Priority 1","24/8/2026"],
    ["00QRC00001M8VKo","ychk49@gmail.com","Priority 1","24/8/2026"],
    ["00QRC00001M8ElO","a01097685264@gmail.com","Priority 1","24/8/2026"],
    ["00QRC00001M9Ttd","ujuin19@naver.com","Priority 1","24/8/2026"],
    ["00QRC00001M9hwb","sungyooahn@naver.com","Priority 1","24/8/2026"],
    ["00QRC00001MHFFz","jaeheepan4@gmail.com","Priority 1","25/8/2026"],
    ["00QRC00001MGrPf","2629eunsoo@gmail.com","Priority 1","25/8/2026"],
    ["00QRC00001MHNY2","smjh14@hotmail.com","Priority 1","25/8/2026"],
    ["00QRC00001MHNkH","kirr99@gmail.com","Priority 1","25/8/2026"],
    ["00QRC00001MHReV","netykim9797@naver.com","Priority 1","25/8/2026"],
    ["00QRC00001MHUAz","thlim30@kis.ac","Priority 1","25/8/2026"],
    ["00QRC00001MHamf","artist57930@gmail.com","Priority 1","25/8/2026"],
    ["00QRC00001MHmiz","yeahee@gmail.com","Priority 1","25/8/2026"],
    ["00QRC00001MLiiP","buruburu78@gmail.com","Priority 1","25/8/2026"],
    ["00QRC00001MMBhH","28yseo@bisce.net","Priority 1","25/8/2026"],
    ["00QRC00001MMjCi","jisunnim1453@gmail.com","Priority 1","25/8/2026"],
    ["00QRC00001MN7mo","smljy1@hotmail.com","Priority 1","26/8/2026"],
    ["00QRC00001MNjNR","jasonkim131516@gmail.com","Priority 1","26/8/2026"],
    ["00QRC00001MNnm2","berry_drawing@naver.com","Priority 1","26/8/2026"],
    ["00QRC00001MNDlm","brookes1224@gmail.com","Priority 1","26/8/2026"],
    ["00QRC00001MP0io","haejin1018@naver.com","Priority 1","26/8/2026"],
    ["00QRC00001MPO8P","honey@hotmail.com","Priority 1","26/8/2026"],
    ["00QRC00001MPQLV","sese706@hotmail.com","Priority 1","26/8/2026"],
    ["00QRC00001MQ5dB","mapletorontomom@gmail.com","Priority 1","26/8/2026"],
    ["00QRC00001MQAOL","young0601@gmail.com","Priority 1","26/8/2026"],
    ["00QRC00001MQZxp","hwan.lee.90@gmail.com","Priority 1","26/8/2026"],
    ["00QRC00001MRKBx","rlsarah3@naver.com","Priority 1","26/8/2026"],
    ["00QRC00001MRcP0","energy0130@naver.com","Priority 1","26/8/2026"],
    ["00QRC00001MUqiL","wjdfkd06@naver.com","Priority 1","26/8/2026"],
    ["00QRC00001MV9y0","e_ariun0320@yahoo.com","Priority 1","26/8/2026"],
    ["00QRC00001JLuF3","hyunjoon.j2030@smis.ac.jp","Priority 1","1/8/2026"],
    ["00QRC00001JaP4T","canantwong@gmail.com","Priority 1","4/8/2026"],
    ["00QRC00001M4jB9","k29870950@gmail.com","Priority 1","23/8/2026"],
    ["00QRC00001JJEVG","dbckdgh@gmail.com","Priority 1","1/8/2026"],
    ["00QRC00001LFzeT","bgfnccoo@gmail.com","Priority 1","15/8/2026"],
    ["00QRC00001LLlov","redrock333@yahoo.com","Priority 1","17/8/2026"],
    ["00QRC00001JUYAU","skim2031@chadwickschool.org","Priority 1","3/8/2026"],
    ["00QRC00001KGIhh","choi.jongsok@gmail.com","Priority 1","5/8/2026"],
    ["00QRC00001KLuUb","ganghaim@gmail.com","Priority 1","6/8/2026"],
    ["00QRC00001Kk5Tl","sakura0s@hanmail.net","Priority 1","10/8/2026"],
    ["00QRC00001Kn7nV","oceans@daum.net","Priority 1","10/8/2026"],
    ["00QRC00001L9pI1","ldear@naver.com","Priority 1","14/8/2026"],
    ["00QRC00001L9Uog","sungwon0108@hotmail.com","Priority 1","14/8/2026"],
    ["00QRC00001L9Nla","missps@daum.net","Priority 1","14/8/2026"],
    ["00QRC00001LhhoH","eunsuk4305@naver.com","Priority 1","19/8/2026"],
    ["00QRC00001LhjoT","kdroom@naver.com","Priority 1","19/8/2026"],
    ["00QRC00001LhkEI","treebird01@naver.com","Priority 1","19/8/2026"],
    ["00QRC00001Ln4qf","richard.kim+test@crimsoneducation.org","Priority 1","20/8/2026"],
    ["00QRC00001M749m","yun0720@korea.kr","Priority 1","23/8/2026"],
    ["00QRC00001MHFFi","choi.jongsok@gmail.com","Priority 1","25/8/2026"],
    ["00QRC00001MNwPW","yuuhx7@gmail.com","Priority 1","26/8/2026"],
    ["00QRC00001MODa1","youngshin.lim78@gmail.con","Priority 1","26/8/2026"],
    ["00QRC00001MOI0D","tesollove@hotmail.con","Priority 1","26/8/2026"],
    ["00QRC00001MTIIw","mdangela79@gmail.com","Priority 1","26/8/2026"],
    ["00QRC00001JKj7D","opvs73@naver.com","Priority 1","1/8/2026"],
    ["00QRC00001KMBQd","librelibro91@gmail.com","Priority 1","6/8/2026"],
    ["00QRC00001KQfY9","jianlee00@gmail.com","Priority 1","7/8/2026"],
    ["00QRC00001KRvZF","pearlphin@hotmail.com","Priority 1","7/8/2026"],
    ["00QRC00001KT5I1","luckybunny797@gmail.com","Priority 1","7/8/2026"],
    ["00QRC00001KY733","jungbum.cho@gmail.com","Priority 1","7/8/2026"],
    ["00QRC00001Kb0cw","ssong608@gmail.com","Priority 1","8/8/2026"],
    ["00QRC00001KbJpF","airis0907@naver.com","Priority 1","8/8/2026"],
    ["00QRC00001KbDNH","thepaywithus@gamil.com","Priority 1","8/8/2026"],
    ["00QRC00001KgvsK","jgarten@naver.com","Priority 1","9/8/2026"],
    ["00QRC00001MH4bi","mania21c2@naver.com","Priority 1","25/8/2026"],
    ["00QRC00001JXmnB","joohi82@naver.com","Priority 1","3/8/2026"],
    ["00QRC00001JcpcL","eun_ji_kim@bat.com","Priority 1","4/8/2026"],
    ["00QRC00001LJkc2","pupu4801@naver.com","Priority 1","16/8/2026"],
    ["00QRC00001MHReS","freechal00@naver.com","Priority 1","25/8/2026"],
    ["00QRC00001JWuI9","luciajuly77@gmail.com","Priority 1","3/8/2026"],
    ["00QRC00001KFudm","li36682@gmail.com","Priority 1","5/8/2026"],
    ["00QRC00001KQJcT","shin102973@gmail.com","Priority 1","7/8/2026"],
    ["00QRC00001L9Zl8","junsuklee78@gmail.com","Priority 1","14/8/2026"],
    ["00QRC00001LE08Q","sohyonyang5454@gmail.com","Priority 1","15/8/2026"],
    ["00QRC00001LRpt3","b01055930110@gmail.com","Priority 1","17/8/2026"],
    ["00QRC00001Lgp9a","shalara75@gmail.com","Priority 1","19/8/2026"],
    ["00QRC00001LqPLv","chloechu0716@gmail.com","Priority 1","21/8/2026"],
    ["00QRC00001MHRdO","sunife@hotmail.com","Priority 1","25/8/2026"],
    ["00QRC00001MO5PZ","cfcf2011@naver.com","Priority 1","26/8/2026"],
    ["00QRC00001JJEJy","joykim1113@gmail.com","Priority 2","1/8/2026"],
    ["00QRC00001JbSQ5","sung.pyun@speclipse.com","Priority 2","4/8/2026"],
    ["00QRC00001KQmPx","choiolivia0514@gmail.com","Priority 2","7/8/2026"],
    ["00QRC00001KtsgU","junewoo0111@naver.com","Priority 2","12/8/2026"],
    ["00QRC00001Kx9OD","wj3990@naver.com","Priority 2","12/8/2026"],
    ["00QRC00001L2sZB","letuslive@nate.com","Priority 2","13/8/2026"],
    ["00QRC00001Li7M9","mjcharlotte@gmail.com","Priority 2","19/8/2026"],
    ["00QRC00001LjIc5","clubmode@naver.com","Priority 2","20/8/2026"],
    ["00QRC00001LqZ1u","hanawhang@gmail.com","Priority 2","20/8/2026"],
    ["00QRC00001LqKPS","yeonho080510@gmail.com","Priority 2","21/8/2026"],
    ["00QRC00001LrdGL","luapkim126@gmail.com","Priority 2","21/8/2026"],
    ["00QRC00001Lrw65","insunyuyoon@gmail.com","Priority 2","21/8/2026"],
    ["00QRC00001LsiM1","bsj2061@gmail.com","Priority 2","21/8/2026"],
    ["00QRC00001LwMwP","melissayasa84@gmail.com","Priority 2","21/8/2026"],
    ["00QRC00001Lyf25","vi462544@gmail.com","Priority 2","21/8/2026"],
    ["00QRC00001LyTCE","bluefish8170@naver.com","Priority 2","21/8/2026"],
    ["00QRC00001LzfpI","ggglee@gmail.com","Priority 2","22/8/2026"],
    ["00QRC00001M0vNh","seon-min@hotmail.com","Priority 2","22/8/2026"],
    ["00QRC00001M2DnB","kowinhbyj00@gmail.com","Priority 2","22/8/2026"],
    ["00QRC00001M2ZPV","kykkjh0712@gmail.com","Priority 2","22/8/2026"],
    ["00QRC00001MNDXF","choanna1231@gmail.com","Priority 2","25/8/2026"],
    ["00QRC00001MS71N","smilete7475@gmail.com","Priority 2","26/8/2026"],
    ["00QRC00001Kh55G","mg223080441@gvcs-mg.org","Priority 2","9/8/2026"],
    ["00QRC00001KwpKg","nisheshshah@gmail.com","Priority 2","12/8/2026"],
    ["00QRC00001Lld2w","sean.pyun@gmail.com","Priority 2","20/8/2026"],
    ["00QRC00001KjUQw","chiwupark@gmail.com","Priority 2","10/8/2026"],
    ["00QRC00001Km3Qz","isabelle0928h@gmail.com","Priority 2","10/8/2026"],
    ["00QRC00001LUVzS","sdonghwans@gmail.com","Priority 2","18/8/2026"],
    ["00QRC00001KM5wJ","angelzhyun@gmail.com","Priority 3","6/8/2026"],
    ["00QRC00001JINKW","speedspectrumd@gmail.com","Priority 3","1/8/2026"],
    ["00QRC00001JJPaL","streamingsuljab@gmail.com","Priority 3","1/8/2026"],
    ["00QRC00001JJF7y","jeonje6@gmail.com","Priority 3","1/8/2026"],
    ["00QRC00001JJRCL","utopiask@naver.com","Priority 3","1/8/2026"],
    ["00QRC00001JKAr0","jisungriv@gmail.com","Priority 3","1/8/2026"],
    ["00QRC00001JKefO","qlgoddnajs@naver.com","Priority 3","1/8/2026"],
    ["00QRC00001JK2v6","piano86@nate.com","Priority 3","1/8/2026"],
    ["00QRC00001JLAiU","wychang2@gmail.com","Priority 3","1/8/2026"],
    ["00QRC00001JLw8n","sensesue@hanmail.net","Priority 3","1/8/2026"],
    ["00QRC00001JMKnp","seungwon0384@gmail.com","Priority 3","1/8/2026"],
    ["00QRC00001JLyDq","sjsung@samik21.com","Priority 3","1/8/2026"],
    ["00QRC00001JMYFh","minhyuk9541@gmail.com","Priority 3","1/8/2026"],
    ["00QRC00001JNMvd","ahnji1313@gmail.com","Priority 3","1/8/2026"],
    ["00QRC00001JNghR","hkjun1013@outlook.com","Priority 3","1/8/2026"],
    ["00QRC00001JNpCr","apeatgia@naver.com","Priority 3","2/8/2026"],
    ["00QRC00001JOGZd","junbo9801@gmail.com","Priority 3","2/8/2026"],
    ["00QRC00001JOrCb","hshyeon1216@gmail.com","Priority 3","2/8/2026"],
    ["00QRC00001JP8wc","hjkumom@gmail.com","Priority 3","2/8/2026"],
    ["00QRC00001JOSkX","jupiter0508@naver.com","Priority 3","2/8/2026"],
    ["00QRC00001JPI1W","pcs1225@naver.com","Priority 3","2/8/2026"],
    ["00QRC00001JPt7V","hhh8019@naver.com","Priority 3","2/8/2026"],
    ["00QRC00001JPNu4","kwk630@gmail.com","Priority 3","2/8/2026"],
    ["00QRC00001JRNY9","eunji5326@hanmail.net","Priority 3","2/8/2026"],
    ["00QRC00001JRJkh","sykim7080@hanmail.net","Priority 3","2/8/2026"],
    ["00QRC00001JRnfV","kgy874@kakao.com","Priority 3","2/8/2026"],
    ["00QRC00001JRpsb","kyj.conter@gmail.com","Priority 3","2/8/2026"],
    ["00QRC00001JS82P","acactus1@nate.com","Priority 3","3/8/2026"],
    ["00QRC00001JRtrO","jbw49774532@gmail.com","Priority 3","3/8/2026"],
    ["00QRC00001JTE7N","nrchoi@naver.com","Priority 3","3/8/2026"],
    ["00QRC00001JSdEL","sasakchoi11@gmail.com","Priority 3","3/8/2026"],
    ["00QRC00001JTPu1","alove236@gmail.com","Priority 3","3/8/2026"],
    ["00QRC00001JTSdN","skdpf4@naver.com","Priority 3","3/8/2026"],
    ["00QRC00001JTtFN","stella04180424@gmail.com","Priority 3","3/8/2026"],
    ["00QRC00001JUGIP","florence430@naver.com","Priority 3","3/8/2026"],
    ["00QRC00001JUHj7","nanumjini@hotmail.com","Priority 3","3/8/2026"],
    ["00QRC00001JWYzB","kim861017@naver.com","Priority 3","3/8/2026"],
    ["00QRC00001JYAhR","beautybjn@naver.com","Priority 3","3/8/2026"],
    ["00QRC00001JYTnK","jamiejkim0412@berkeley.edu","Priority 3","3/8/2026"],
    ["00QRC00001JZR9y","jieun24jenny@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001JaH26","kimmingyu2009510@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001JaiDZ","qhdms3125@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001JaSTm","lovebssa80@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001JbV7p","lenajsy2011@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001JbZ6b","lany2u@naver.com","Priority 3","4/8/2026"],
    ["00QRC00001JbTfW","yuliya1022@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001JdNFp","sypark6271@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001JdmVy","jurara80@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001Jf1BB","tgg4904@naver.com","Priority 3","4/8/2026"],
    ["00QRC00001JeIpC","ddukback@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001JfX1N","9binial9@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001JflZ1","kangwh74@gmail.com","Priority 3","4/8/2026"],
    ["00QRC00001JnsQP","jaehwan5495@naver.com","Priority 3","4/8/2026"],
    ["00QRC00001JuFgr","kommjj@nate.com","Priority 3","4/8/2026"],
    ["00QRC00001Jx9rq","tnwjdonl@gmail.com","Priority 3","5/8/2026"],
    ["00QRC00001K1WQ1","bhwang81@gmail.com","Priority 3","5/8/2026"],
    ["00QRC00001K4VAt","bma1234567mama@gmail.com","Priority 3","5/8/2026"],
    ["00QRC00001K2CAk","sunsook-kim@outlook.com","Priority 3","5/8/2026"],
    ["00QRC00001K9zY5","haneljh01@gmail.com","Priority 3","5/8/2026"],
    ["00QRC00001KA7qb","yxixj2007@gmail.com","Priority 3","5/8/2026"],
    ["00QRC00001KAbrt","chodidake@naver.com","Priority 3","5/8/2026"],
    ["00QRC00001KAfU6","biancaperu83@gmail.com","Priority 3","5/8/2026"],
    ["00QRC00001KD1ez","kimy0625@yahoo.com","Priority 3","5/8/2026"],
    ["00QRC00001KDm7d","h2s37hc@gmail.com","Priority 3","5/8/2026"],
    ["00QRC00001KEKVt","jenny-art@naver.com","Priority 3","5/8/2026"],
    ["00QRC00001KEf2U","carahappy@naver.com","Priority 3","5/8/2026"],
    ["00QRC00001KHXgH","hyein2642722@gmail.com","Priority 3","6/8/2026"],
    ["00QRC00001KHpV7","lunarlaskdms@gmail.com","Priority 3","6/8/2026"],
    ["00QRC00001KJ4of","s5gcho16@gmail.com","Priority 3","6/8/2026"],
    ["00QRC00001KJVth","jyh10000@naver.com","Priority 3","6/8/2026"],
    ["00QRC00001KLQ57","1024sf@daum.net","Priority 3","6/8/2026"],
    ["00QRC00001KLihx","gan8517@naver.com","Priority 3","6/8/2026"],
    ["00QRC00001KLyOX","yvetteyoo.25@gmail.com","Priority 3","6/8/2026"],
    ["00QRC00001KNAIq","daphne319@gmail.com","Priority 3","6/8/2026"],
    ["00QRC00001KP8ZR","jenniferchoi123@gmail.com","Priority 3","6/8/2026"],
    ["00QRC00001KQJ9R","sp.justinshin2@gmail.com","Priority 3","7/8/2026"],
    ["00QRC00001KQRQL","jeonyena10@naver.com","Priority 3","7/8/2026"],
    ["00QRC00001KQcTp","gagax33@naver.com","Priority 3","7/8/2026"],
    ["00QRC00001KRDzd","qpt111111111@gmail.com","Priority 3","7/8/2026"],
    ["00QRC00001KRFv0","junseogang67@gmail.com","Priority 3","7/8/2026"],
    ["00QRC00001KRf6H","0906lmw@hanmail.net","Priority 3","7/8/2026"],
    ["00QRC00001KRyP3","pnn1004@naver.com","Priority 3","7/8/2026"],
    ["00QRC00001KS5iH","onlycookie77@gmail.com","Priority 3","7/8/2026"],
    ["00QRC00001KSTO1","tsar11skosk@gmail.com","Priority 3","7/8/2026"],
    ["00QRC00001KT9a9","rcho3452@naver.com","Priority 3","7/8/2026"],
    ["00QRC00001KU2Uz","ci9865821@gmail.com","Priority 3","7/8/2026"],
    ["00QRC00001KUWMc","jounelina08@gmail.com","Priority 3","7/8/2026"],
    ["00QRC00001KXnKT","lehwabin0011@gmail.com","Priority 3","7/8/2026"],
    ["00QRC00001KYzwJ","a32851617@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001Ka5d4","minee1008@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001KaSmY","ny6643@naver.com","Priority 3","8/8/2026"],
    ["00QRC00001KcJOz","jiu064258@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001Kcis1","cheongyuna630@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001KcYpz","jenney6225@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001KcKmU","hj0802@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001Kd3y7","yunheekim.leah@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001KdKpG","ljhryan0411@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001KdX6Y","a01080217699@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001KdsSj","amberjo804@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001Kdbms","like2hye@naver.com","Priority 3","8/8/2026"],
    ["00QRC00001KdbJq","ablegem25@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001KdyjS","pedram818@gmail.com","Priority 3","9/8/2026"],
    ["00QRC00001KdMKr","wlsgur7831@naver.com","Priority 3","9/8/2026"],
    ["00QRC00001KeF5y","eunjeeyangg@gmail.com","Priority 3","9/8/2026"],
    ["00QRC00001Kege4","caj4100@gmail.com","Priority 3","9/8/2026"],
    ["00QRC00001KfHKD","ledix26@hanmail.net","Priority 3","9/8/2026"],
    ["00QRC00001Kf06b","a01050061381@gmail.com","Priority 3","9/8/2026"],
    ["00QRC00001KfONJ","star8385@naver.com","Priority 3","9/8/2026"],
    ["00QRC00001Kfev7","noxclavis@gmail.com","Priority 3","9/8/2026"],
    ["00QRC00001KfXvI","csm.5649@gmail.com","Priority 3","9/8/2026"],
    ["00QRC00001Kgq1N","leejiwoo0910@gmail.com","Priority 3","9/8/2026"],
    ["00QRC00001Kh4Vl","minjubae466@gmail.com","Priority 3","9/8/2026"],
    ["00QRC00001KhFRB","seunghwan081@gmail.com","Priority 3","9/8/2026"],
    ["00QRC00001Kgnza","20267350@chauniv.ac.kr","Priority 3","9/8/2026"],
    ["00QRC00001KhFmA","cupid0924@naver.com","Priority 3","9/8/2026"],
    ["00QRC00001KhNbf","rnaysy12@naver.com","Priority 3","10/8/2026"],
    ["00QRC00001Kiegr","a01076868249@gmail.com","Priority 3","10/8/2026"],
    ["00QRC00001KjkST","lee.sungeun@hanmail.net","Priority 3","10/8/2026"],
    ["00QRC00001KkVT1","dbwodyd1122@gmail.com","Priority 3","10/8/2026"],
    ["00QRC00001KlLjJ","heodayeong187@gmail.com","Priority 3","10/8/2026"],
    ["00QRC00001Km80r","hanna8cho@gmail.com","Priority 3","10/8/2026"],
    ["00QRC00001KmZnR","jinhana4180@gmail.com","Priority 3","10/8/2026"],
    ["00QRC00001KnNDx","yesrin12@gmail.com","Priority 3","10/8/2026"],
    ["00QRC00001KnQGf","wshh813@gmail.com","Priority 3","10/8/2026"],
    ["00QRC00001KnLs7","kimhyomin0627@gmail.com","Priority 3","10/8/2026"],
    ["00QRC00001Ko07F","mingyeongbyeon143@gmail.com","Priority 3","10/8/2026"],
    ["00QRC00001KoO4j","mrhans0128@gmail.com","Priority 3","11/8/2026"],
    ["00QRC00001KoS3V","richdisco@naver.com","Priority 3","11/8/2026"],
    ["00QRC00001KnzUa","changyelly@gmail.com","Priority 3","11/8/2026"],
    ["00QRC00001KoR94","jiyoon.yeo92@gmail.com","Priority 3","11/8/2026"],
    ["00QRC00001Kpb4l","thurum@gmail.com","Priority 3","11/8/2026"],
    ["00QRC00001KqGSr","orkim0803@gmail.com","Priority 3","11/8/2026"],
    ["00QRC00001Kqblr","nomoretears@mac.com","Priority 3","11/8/2026"],
    ["00QRC00001KqNlF","kimsy_0807@naver.com","Priority 3","11/8/2026"],
    ["00QRC00001KrO09","sogmi@hanmail.net","Priority 3","11/8/2026"],
    ["00QRC00001KrtVN","minsolg149@gmail.com","Priority 3","11/8/2026"],
    ["00QRC00001KsUTJ","seiyoun80@naver.com","Priority 3","11/8/2026"],
    ["00QRC00001Ks663","doxeeel@gmail.com","Priority 3","11/8/2026"],
    ["00QRC00001KtSiq","iscaveo@gmail.com","Priority 3","12/8/2026"],
    ["00QRC00001Kuxm9","rjdalswhd7890@gmail.com","Priority 3","12/8/2026"],
    ["00QRC00001KvN0g","jh.shin0802@icloud.com","Priority 3","12/8/2026"],
    ["00QRC00001KvRKR","hyein999@naver.com","Priority 3","12/8/2026"],
    ["00QRC00001Kww2p","jeonyj0001@gmail.com","Priority 3","12/8/2026"],
    ["00QRC00001Kz9C2","princess_hsy@naver.com","Priority 3","12/8/2026"],
    ["00QRC00001L03qw","eunicepark@yonsei.ac.kr","Priority 3","12/8/2026"],
    ["00QRC00001L0LMQ","sya1eud3na@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001L0nIf","woogle82@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001L0srs","munsohyun1119@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001L29nN","sean.hwangsy@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001L2SlB","sogidenty@naver.com","Priority 3","13/8/2026"],
    ["00QRC00001L2ti9","trabysam@naver.com","Priority 3","13/8/2026"],
    ["00QRC00001L3FFd","kmj09183@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001L3obZ","coolrules@naver.com","Priority 3","13/8/2026"],
    ["00QRC00001L43CP","banjimin07@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001L47BB","akcnr@naver.com","Priority 3","13/8/2026"],
    ["00QRC00001L4joL","sdtree512@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001L4sd7","jkluvsk@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001L3Gq4","jamongade7@naver.com","Priority 3","13/8/2026"],
    ["00QRC00001L4kvj","fggjhfdfghy@naver.com","Priority 3","13/8/2026"],
    ["00QRC00001L6ILp","seeunoh2014@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001L6Xnt","t01085507624@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001L5tgp","jooah100402@naver.com","Priority 3","13/8/2026"],
    ["00QRC00001L6qlh","through_touch_1z@icloud.com","Priority 3","13/8/2026"],
    ["00QRC00001L7VYj","megastar2be@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001L7kKr","si9408303@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001L7nSQ","es.gracesong@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001L7uwv","jy_kwon@yahoo.com","Priority 3","14/8/2026"],
    ["00QRC00001L8XVG","wwgracekim@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001L88Bw","seokyong.kauh@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001L9QrX","pinkydol21@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001L9qNl","halcyon03@naver.com","Priority 3","14/8/2026"],
    ["00QRC00001L9rGb","wk5678@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001L9sPZ","eunseobag502@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001L9urB","d5ni.833460479@facebemail.com","Priority 3","14/8/2026"],
    ["00QRC00001LA9Td","bokyung.kim84@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001LAIof","yujuamry0613@naver.com","Priority 3","14/8/2026"],
    ["00QRC00001LBx4z","byeonjaegwan3@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001LCoip","love.jenny.sky@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LDQZZ","yuhank730@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LDZt0","je1ny@hotmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LDeXh","sikchoo@naver.com","Priority 3","15/8/2026"],
    ["00QRC00001LDJ8J","bfgf777@naver.com","Priority 3","15/8/2026"],
    ["00QRC00001LDpsw","zzoony83@naver.com","Priority 3","15/8/2026"],
    ["00QRC00001LEQnd","young2choi@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LELcj","misunjennyan@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LEYoP","ming0102123@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LEZZB","bona080919@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LEn7V","nfriends1004@naver.com","Priority 3","15/8/2026"],
    ["00QRC00001LEv8H","2youngmin08@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LEvg9","selixzuq1664@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LG6pe","joojinl@hotmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LG74A","hagyun0829@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LG5Dg","hamcy0624@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LGQWb","wekeedxepherroar@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LGTr3","soyxnn10@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LGV4r","jjeong121@naver.com","Priority 3","15/8/2026"],
    ["00QRC00001LG2pH","itxitd@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LGVck","sunghoon.yoon@gmail.com","Priority 3","15/8/2026"],
    ["00QRC00001LGtLh","sayurang81@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LGusr","saccacc@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LGVL0","drimer@naver.com","Priority 3","16/8/2026"],
    ["00QRC00001LHZSz","lattifa80@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LHghP","reeseahn@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LHvDN","soot79@naver.com","Priority 3","16/8/2026"],
    ["00QRC00001LI6yP","doojinwon2@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LIMYX","minz200905@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LITbd","dongilgim113@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LIYWT","chanheecho@hanmail.net","Priority 3","16/8/2026"],
    ["00QRC00001LIc5R","jinny081004@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LIDtS","luo82@naver.com","Priority 3","16/8/2026"],
    ["00QRC00001LIg0z","carotid2009@naver.com","Priority 3","16/8/2026"],
    ["00QRC00001LImsn","acts799100@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LIvMb","leejumi2411@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LInnH","ohajun143@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LIw4C","jinshim20@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LIv3G","mosimosi71@naver.com","Priority 3","16/8/2026"],
    ["00QRC00001LJIr3","bonitao717@naver.com","Priority 3","16/8/2026"],
    ["00QRC00001LJKKz","01nxij@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LJLov","hoho3813@naver.com","Priority 3","16/8/2026"],
    ["00QRC00001LJPR7","0824sayun@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LJPan","bdmizero@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LJnmo","deoji55@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LJtXF","hwanheejung117@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LKBqj","rudarora@naver.com","Priority 3","16/8/2026"],
    ["00QRC00001LK5zq","khai506@hotmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LKCV4","mende93@naver.com","Priority 3","17/8/2026"],
    ["00QRC00001LKCbZ","sophia080402@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LK8zO","a01057376527@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LKhXG","halynn8326@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LKu80","toys797979@naver.com","Priority 3","17/8/2026"],
    ["00QRC00001LKsEA","2ppuny810705@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LKq2h","hyojookim15@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LL2Oo","ysh880707@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LM1yX","impoisno20@naver.com","Priority 3","17/8/2026"],
    ["00QRC00001LMAKH","cone2424@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LNfYv","yk070900@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LMLna","0122imhouri@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LO8sl","gajami2662@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LOmZx","dorisbw13@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LOsvV","hyeonseokim002@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LP1Z0","watepot2302@naver.com","Priority 3","17/8/2026"],
    ["00QRC00001LQgbh","kkm292@naver.com","Priority 3","17/8/2026"],
    ["00QRC00001LRZ8L","kshoon70@naver.com","Priority 3","17/8/2026"],
    ["00QRC00001LRw8A","yejinreah1023@gmail.com","Priority 3","18/8/2026"],
    ["00QRC00001LS4X7","claireyekim@gmail.com","Priority 3","18/8/2026"],
    ["00QRC00001LTDTV","jamiro37@gmail.com","Priority 3","18/8/2026"],
    ["00QRC00001LTJcA","nicebobae@naver.com","Priority 3","18/8/2026"],
    ["00QRC00001LTh9p","badamaa.gu@gmail.com","Priority 3","18/8/2026"],
    ["00QRC00001LTdvq","xodil78896@umeifun.com","Priority 3","18/8/2026"],
    ["00QRC00001LTutR","jiye0408@gmail.com","Priority 3","18/8/2026"],
    ["00QRC00001LUC8o","buok0310@gmail.com","Priority 3","18/8/2026"],
    ["00QRC00001LVj13","andy376@naver.com","Priority 3","18/8/2026"],
    ["00QRC00001LXKzR","dowon9287@gmail.com","Priority 3","18/8/2026"],
    ["00QRC00001LY6xd","jyo9306@yuhs.ac","Priority 3","18/8/2026"],
    ["00QRC00001LYFeL","minjeongkoo0514@gmail.com","Priority 3","18/8/2026"],
    ["00QRC00001LYGDp","christy_jung@naver.com","Priority 3","18/8/2026"],
    ["00QRC00001LYZGT","ha_rang09@naver.com","Priority 3","18/8/2026"],
    ["00QRC00001LZtWo","kyungwonlee.jamie@gmail.com","Priority 3","18/8/2026"],
    ["00QRC00001LabME","feliz.alice@gmail.com","Priority 3","19/8/2026"],
    ["00QRC00001LbHri","erianna34@gmail.com","Priority 3","19/8/2026"],
    ["00QRC00001Lbybh","jua09090@naver.com","Priority 3","19/8/2026"],
    ["00QRC00001LbnWc","andud331@naver.com","Priority 3","19/8/2026"],
    ["00QRC00001LclR7","lovehk2@naver.com","Priority 3","19/8/2026"],
    ["00QRC00001LdHqn","jc2518@gmail.com","Priority 3","19/8/2026"],
    ["00QRC00001Lfje5","yebongang0@gmail.com","Priority 3","19/8/2026"],
    ["00QRC00001LgPF8","ui889945@gmail.com","Priority 3","19/8/2026"],
    ["00QRC00001LfczC","0weol2m@gmail.com","Priority 3","19/8/2026"],
    ["00QRC00001LhRBf","kimeojin2006@hanmail.net","Priority 3","19/8/2026"],
    ["00QRC00001Lhp5t","kyunakyung@gmail.com","Priority 3","19/8/2026"],
    ["00QRC00001Lijkn","wolpjhs@gmail.com","Priority 3","20/8/2026"],
    ["00QRC00001LimCP","sojoooa@naver.com","Priority 3","20/8/2026"],
    ["00QRC00001LimPJ","a01083358602@icloud.com","Priority 3","20/8/2026"],
    ["00QRC00001Lk9TX","sky-2351@nate.com","Priority 3","20/8/2026"],
    ["00QRC00001LkSr8","joony.cho@gmail.com","Priority 3","20/8/2026"],
    ["00QRC00001LmvDt","lsh9365@naver.com","Priority 3","20/8/2026"],
    ["00QRC00001LmtiM","shawneom@naver.com","Priority 3","20/8/2026"],
    ["00QRC00001Lo0pp","leechanbi00@gmail.com","Priority 3","20/8/2026"],
    ["00QRC00001Lp5FZ","kkiko79@naver.com","Priority 3","20/8/2026"],
    ["00QRC00001LpLfJ","lsh47273303@gmail.com","Priority 3","20/8/2026"],
    ["00QRC00001LpLnN","jasd.usolp_s@icloud.com","Priority 3","20/8/2026"],
    ["00QRC00001Lq8GE","robot3082@naver.com","Priority 3","20/8/2026"],
    ["00QRC00001LrHSj","choeunjun009@gmail.com","Priority 3","21/8/2026"],
    ["00QRC00001LrIrp","wlwhs4eva@naver.com","Priority 3","21/8/2026"],
    ["00QRC00001LreCP","mhs0515@naver.com","Priority 3","21/8/2026"],
    ["00QRC00001Ls7MT","sonicmcdo@gmail.com","Priority 3","21/8/2026"],
    ["00QRC00001Lsd4b","pipimn@naver.com","Priority 3","21/8/2026"],
    ["00QRC00001LtlZZ","thsoy@gmail.com","Priority 3","21/8/2026"],
    ["00QRC00001LtoE5","jihuncho@sk.com","Priority 3","21/8/2026"],
    ["00QRC00001Lv32z","coriyoon@naver.com","Priority 3","21/8/2026"],
    ["00QRC00001LvA7h","chayurim0724@naver.com","Priority 3","21/8/2026"],
    ["00QRC00001LwiAX","tjcbrian@gmail.com","Priority 3","21/8/2026"],
    ["00QRC00001LwWhG","sonjihyeog88@gmail.com","Priority 3","21/8/2026"],
    ["00QRC00001Lxi21","a01053174356@gmail.com","Priority 3","21/8/2026"],
    ["00QRC00001LzDoZ","seojunbang098@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001Lzaun","bungabunga060108@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001LzPXy","mwcxae0128@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001LzniL","captainminhoo@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001Lzr2o","elena-love@naver.com","Priority 3","22/8/2026"],
    ["00QRC00001LziPM","jhchae1202@naver.com","Priority 3","22/8/2026"],
    ["00QRC00001M0t49","glory530@paran.com","Priority 3","22/8/2026"],
    ["00QRC00001M0l51","loveahh@daum.net","Priority 3","22/8/2026"],
    ["00QRC00001M0cD2","remnant000@nate.com","Priority 3","22/8/2026"],
    ["00QRC00001M1NDW","ekimth@naver.com","Priority 3","22/8/2026"],
    ["00QRC00001M1da1","theilovesoy@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001M1a2i","a34970722@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001M276f","heymiri@naver.com","Priority 3","22/8/2026"],
    ["00QRC00001M1bOc","a96062837@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001M2SpR","lhtsjrhrh@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001M1zU6","sungjun-b@naver.com","Priority 3","22/8/2026"],
    ["00QRC00001M35ly","chweeunju0920@snu.ac.kr","Priority 3","22/8/2026"],
    ["00QRC00001M2rfm","taein0524@icloud.com","Priority 3","22/8/2026"],
    ["00QRC00001M3CU8","wings24011128@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001M3r5L","yoonds0307@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001M3Ati","sosacucumber@naver.com","Priority 3","22/8/2026"],
    ["00QRC00001M4MHh","hyeryeon2548@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M4Jf9","erin.eungyo.choi@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M4PnS","a87003629@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M4oKQ","poison9508@naver.com","Priority 3","23/8/2026"],
    ["00QRC00001M56ag","juliasbubble@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M68Dp","hgim42943@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M6AUA","parkjuna0531@naver.com","Priority 3","23/8/2026"],
    ["00QRC00001M60Ze","t8694884@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M6tUU","rakky1110@naver.com","Priority 3","23/8/2026"],
    ["00QRC00001M701J","jiyea1118@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M71VF","ihyeonjeong816@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M729Z","jincecil@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M79HV","meiai061@naver.com","Priority 3","23/8/2026"],
    ["00QRC00001M7FBd","jychang@hanyang.ac.kr","Priority 3","23/8/2026"],
    ["00QRC00001M7Cdb","bgfo007@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M7LYn","youhn2008@icloud.com","Priority 3","23/8/2026"],
    ["00QRC00001M7Xuv","adelig0412@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M7u57","jooingi0205@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001M8UAD","michaelachoo@gmail.com","Priority 3","24/8/2026"],
    ["00QRC00001M8UN7","chrisj21@naver.com","Priority 3","24/8/2026"],
    ["00QRC00001M8TsV","qqjihee@nate.com","Priority 3","24/8/2026"],
    ["00QRC00001M82XM","gwpark0730@gmail.com","Priority 3","24/8/2026"],
    ["00QRC00001M95cp","chamj81@gmail.com","Priority 3","24/8/2026"],
    ["00QRC00001M9uPC","cookieoki515152@gmail.com","Priority 3","24/8/2026"],
    ["00QRC00001MBq69","sunnytory1025@gmail.com","Priority 3","24/8/2026"],
    ["00QRC00001MHFDD","qw10er05ty20@kakao.com","Priority 3","25/8/2026"],
    ["00QRC00001MHFDG","mybeverything@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MHFFH","meirong3656@naver.com","Priority 3","25/8/2026"],
    ["00QRC00001MHFGc","hr__________@naver.com","Priority 3","25/8/2026"],
    ["00QRC00001MHFgK","ddjekkw@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MHI2t","haejjyu0967@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MH6WJ","ryuin2007@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MHRdb","ohjiwoo3484@naver.com","Priority 3","25/8/2026"],
    ["00QRC00001MHRde","yoosujin1218@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MHKpz","seoyepark@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MHXtd","freddy2004@naver.com","Priority 3","25/8/2026"],
    ["00QRC00001MHmav","innitable@naver.com","Priority 3","25/8/2026"],
    ["00QRC00001MIx65","sujungha0321@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MJCWX","scissam@naver.com","Priority 3","25/8/2026"],
    ["00QRC00001MJAHq","jdiej2141@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MKJ69","ekk1615@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MJvwg","su3ha5@hanmail.net","Priority 3","25/8/2026"],
    ["00QRC00001MKwST","dkfmadl7471@kakao.com","Priority 3","25/8/2026"],
    ["00QRC00001MLs8H","sangkoohan@naver.com","Priority 3","25/8/2026"],
    ["00QRC00001MLsuf","joeunsung0808@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MMAze","s20212536@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MNBTp","takingx@naver.com","Priority 3","25/8/2026"],
    ["00QRC00001MN1Kp","youngjin120828@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MNGDN","bokiwagang@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MNRoj","joonseo388@gmail.com","Priority 3","25/8/2026"],
    ["00QRC00001MNe2n","senmsenm826072@goedu.kr","Priority 3","26/8/2026"],
    ["00QRC00001MNgZF","bujune@naver.com","Priority 3","26/8/2026"],
    ["00QRC00001MNiSz","junhaiankim@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MNlsH","dani0106@hotmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MNpvt","chicken31468@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MNxLa","2ezywoo@naver.com","Priority 3","26/8/2026"],
    ["00QRC00001MO1lo","ronica7@naver.com","Priority 3","26/8/2026"],
    ["00QRC00001MPjcf","happyjev@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MRA69","hongjin1227@nate.com","Priority 3","26/8/2026"],
    ["00QRC00001MRGEn","goodfly830@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MTXwH","esmebp11@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MUBaL","godzzang1326@naver.com","Priority 3","26/8/2026"],
    ["00QRC00001MUM2j","elliemou826@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MUVqo","yoonjung.cho99@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MV2mj","bj7887@naver.com","Priority 3","26/8/2026"],
    ["00QRC00001MUb6d","agoodfool1104@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MV88z","swoosmile@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MVLRB","love007lim@icloud.com","Priority 3","26/8/2026"],
    ["00QRC00001LAizF","haileyp0802@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001LFtPN","aayushkumar_@outlook.com","Priority 3","15/8/2026"],
    ["00QRC00001LkPre","yhy2411@naver.com","Priority 3","20/8/2026"],
    ["00QRC00001M0pa9","xmslzkrl@naver.com","Priority 3","22/8/2026"],
    ["00QRC00001M3FkW","jh.julie.lee@gmail.com","Priority 3","23/8/2026"],
    ["00QRC00001Kr4Pd","hyosungkim0208@gmail.com","Priority 3","11/8/2026"],
    ["00QRC00001LCin3","jungsangwoon93@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001LJH5N","nolja0125@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LPq0Q","happyun12341234@gmail.com","Priority 3","17/8/2026"],
    ["00QRC00001LUZDS","sangwoon93@naver.com","Priority 3","18/8/2026"],
    ["00QRC00001LWdcj","tnalslek79@gmail.com","Priority 3","18/8/2026"],
    ["00QRC00001LtJmz","yujin14235@gmail.com","Priority 3","21/8/2026"],
    ["00QRC00001M03vB","heisyou@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001M4YCP","snfl09@icloud.com","Priority 3","23/8/2026"],
    ["00QRC00001M8DZT","avesofficial10@gmail.com","Priority 3","24/8/2026"],
    ["00QRC00001MHETn","hanna-yu@naver.com","Priority 3","25/8/2026"],
    ["00QRC00001MRC1V","hediyenasirii86@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001JOl2N","piano48699@naver.com","Priority 3","2/8/2026"],
    ["00QRC00001JSIkv","vancouver830630@gmail.com","Priority 3","3/8/2026"],
    ["00QRC00001LLcbx","hj773141@nate.com","Priority 3","17/8/2026"],
    ["00QRC00001Lgjye","ph3.4@navercorp.com","Priority 3","19/8/2026"],
    ["00QRC00001Lm0U9","moana9945@gmail.com","Priority 3","20/8/2026"],
    ["00QRC00001LmcBF","misun.jeong79@gmail.com","Priority 3","20/8/2026"],
    ["00QRC00001MQDcL","phligut@naver.com","Priority 3","26/8/2026"],
    ["00QRC00001MUkmb","joeykim2012ny@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001MUkxu","iyjang38@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001Kb1Iu","anna.kye@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001K9l6w","ywsahn@gmail.com","Priority 3","5/8/2026"],
    ["00QRC00001KNo05","beaunose00@gmail.com","Priority 3","6/8/2026"],
    ["00QRC00001KnJqJ","suin2406@naver.com","Priority 3","10/8/2026"],
    ["00QRC00001M3UFi","symin1117@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001JVnvS","yunyel0817@naver.com","Priority 3","3/8/2026"],
    ["00QRC00001KHUaO","photobeat1@naver.com","Priority 3","6/8/2026"],
    ["00QRC00001KxB1p","agga812003@gmail.com","Priority 3","12/8/2026"],
    ["00QRC00001L4BMr","rexminjunjang58@gmail.com","Priority 3","13/8/2026"],
    ["00QRC00001MT917","lilusya2003@gmail.com","Priority 3","26/8/2026"],
    ["00QRC00001K7zh4","ocatdesign@naver.com","Priority 3","5/8/2026"],
    ["00QRC00001KNZ5t","yangsheep2024@gmail.com","Priority 3","6/8/2026"],
    ["00QRC00001KTxwj","yhrighteous@gmail.com","Priority 3","7/8/2026"],
    ["00QRC00001KbudW","dbdbswo0207@gmail.com","Priority 3","8/8/2026"],
    ["00QRC00001L7A2r","vonsehwan@gmail.com","Priority 3","14/8/2026"],
    ["00QRC00001LGiRv","guardianz2020@gmail.com","Priority 3","16/8/2026"],
    ["00QRC00001LULLl","kgy071008@naver.com","Priority 3","18/8/2026"],
    ["00QRC00001LVxgj","haengjin_lee@naver.com","Priority 3","18/8/2026"],
    ["00QRC00001Lqirb","jk0129.kim@samsung.com","Priority 3","21/8/2026"],
    ["00QRC00001M0HYM","hardyon24@gmail.com","Priority 3","22/8/2026"],
    ["00QRC00001M6CR7","baobei1124@hyundaigreenfood.com","Priority 3","23/8/2026"],
    ["00QRC00001MO5Cf","jh.kim@cnjchem.net","Priority 3","26/8/2026"],
    ["00QRC00001KHDEb","trendcurator@gmail.com","Priority 3","5/8/2026"]  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS_MASTER);
  const opsSheet = ss.getSheetByName(OPS.SHEET.OPS);

  if(!masterSheet){ Logger.log(CONFIG.SHEETS.LEADS_MASTER + " 시트를 찾을 수 없습니다."); return; }
  if(!opsSheet){ Logger.log(OPS.SHEET.OPS + " 시트를 찾을 수 없습니다."); return; }

  function normId(v){ return String(v || "").trim(); }

  const masterById = {};
  sheetToObjects(masterSheet).forEach(function(r){
    const id = normId(r["Lead ID"]);
    if(id) masterById[id] = r;
  });

  const opsById = {};
  sheetToObjects(opsSheet).forEach(function(r){
    const id = normId(r["Lead ID"]);
    if(id) opsById[id] = r;
  });

  const notInMaster = [];
  const notInOps = [];
  const priorityStaleAtMaster = [];
  const priorityStaleAtOpsOnly = [];
  const suppressedByOverride = [];
  const ok = [];
  const okNotP1Either = [];

  SALESFORCE_NEW_LEADS.forEach(function(row){

    const leadId = normId(row[0]);
    const email = row[1];
    const sfIsP1 = row[2] === "Priority 1";

    const masterRow = masterById[leadId];

    if(!masterRow){
      notInMaster.push(leadId + " (" + email + ", SF Priority=\"" + row[2] + "\")");
      return;
    }

    const opsRow = opsById[leadId];

    if(!opsRow){
      notInOps.push(
        leadId + " (" + email + ", SF Priority=\"" + row[2] +
        "\") — Leads_Master Lead Priority=\"" + masterRow["Lead Priority"] + "\""
      );
      return;
    }

    const masterPriority = String(masterRow["Lead Priority"] || "").trim();
    const opsPriority = String(opsRow["Lead Priority"] || "").trim();
    const opsOverride = String(opsRow["Priority Override"] || "").trim();
    const weCallP1 = isEffectiveP1_(opsRow["Lead Priority"], opsRow["Priority Override"]);

    if(!sfIsP1){
      okNotP1Either.push(leadId);
      return;
    }

    // 여기부터는 Salesforce=Priority 1인 케이스만

    if(weCallP1){
      ok.push(leadId);
      return;
    }

    // Salesforce는 P1인데 우리는 아님 — 원인 세분화
    if(opsOverride !== "" && opsOverride !== "Priority 1"){
      suppressedByOverride.push(
        leadId + " (" + email + ") — Leads_OPS Priority Override=\"" + opsOverride +
        "\"가 Lead Priority=\"" + opsPriority + "\"를 덮어씀"
      );
    } else if(masterPriority !== "Priority 1"){
      priorityStaleAtMaster.push(
        leadId + " (" + email + ") — Leads_Master Lead Priority=\"" + masterPriority +
        "\" (Salesforce 현재값=Priority 1, 우리 쪽 스냅샷이 예전 값)"
      );
    } else if(opsPriority !== "Priority 1"){
      priorityStaleAtOpsOnly.push(
        leadId + " (" + email + ") — Leads_Master은 Priority 1인데 Leads_OPS Lead Priority=\"" +
        opsPriority + "\" (mergeOPS/sync 단계에서 어긋남)"
      );
    } else {
      priorityStaleAtMaster.push(
        leadId + " (" + email + ") — 분류 불가(Master=\"" + masterPriority +
        "\", OPS=\"" + opsPriority + "\", Override=\"" + opsOverride + "\")"
      );
    }

  });

  Logger.log("========== Salesforce 8월 New Leads(" + SALESFORCE_NEW_LEADS.length +
    "건, Priority 1=" + SALESFORCE_NEW_LEADS.filter(function(r){ return r[2] === "Priority 1"; }).length +
    "건) vs 파이프라인 대조 ==========");
  Logger.log("정상 일치(Salesforce P1 = 우리도 P1)                    : " + ok.length);
  Logger.log("정상 일치(Salesforce P1 아님 = 우리도 P1 아님)          : " + okNotP1Either.length);
  Logger.log("Leads_Master에도 없음(Import 공백)                      : " + notInMaster.length);
  Logger.log("Leads_Master엔 있는데 Leads_OPS엔 없음(mergeOPS 배제)   : " + notInOps.length);
  Logger.log("Priority Override가 P1을 억제함                         : " + suppressedByOverride.length);
  Logger.log("Leads_Master Lead Priority 자체가 예전 값(스냅샷 지연)  : " + priorityStaleAtMaster.length);
  Logger.log("Leads_Master은 P1인데 Leads_OPS만 어긋남                : " + priorityStaleAtOpsOnly.length);

  Logger.log("");
  Logger.log("---- Leads_Master에도 없음 (" + notInMaster.length + "건) ----");
  notInMaster.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- Leads_Master엔 있는데 Leads_OPS엔 없음 (" + notInOps.length + "건) ----");
  notInOps.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- Priority Override가 P1을 억제함 (" + suppressedByOverride.length + "건) ----");
  suppressedByOverride.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- Leads_Master Lead Priority 자체가 예전 값 (" + priorityStaleAtMaster.length + "건) ----");
  priorityStaleAtMaster.forEach(function(line){ Logger.log(line); });

  Logger.log("");
  Logger.log("---- Leads_Master은 P1인데 Leads_OPS만 어긋남 (" + priorityStaleAtOpsOnly.length + "건) ----");
  priorityStaleAtOpsOnly.forEach(function(line){ Logger.log(line); });

}


/**
 * ==========================================================
 * Trace Stale-Priority Leads In MTA_Master
 *
 * WHY
 * runCompareAugustNewP1AgainstSalesforce()가 찾아낸 10건(Leads_Master
 * Lead Priority가 Salesforce 현재값보다 예전 것)이 MTA_Master(터치 단위,
 * 별도의 "Lead Priority" 컬럼 보유)에는 최신 값이 이미 들어와 있는지
 * 확인한다. 만약 MTA_Master 쪽엔 최신 Priority가 있다면, 별도의
 * Salesforce 리포트/파이프라인(ICFunnel_Raw류) 없이도 이미 확보된
 * 데이터를 Leads_Master/Leads_OPS로 역동기화하는 것만으로 해결 가능할
 * 수 있어 해결 난이도가 크게 달라진다.
 *
 * **읽기 전용** — 아무것도 쓰지 않음(TEMPQA 관례).
 * ==========================================================
 */
function runTraceStalePriorityLeadsInMTA(){

  const STALE_LEAD_IDS = [
    "00QRC00001JTNAf", "00QRC00001JYdWX", "00QRC00001KDF21", "00QRC00001KNs3h",
    "00QRC00001KQzqD", "00QRC00001KTmLN", "00QRC00001KaOz3", "00QRC00001KfBV0",
    "00QRC00001Krphv", "00QRC00001M1xdb"
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mtaSheet = ss.getSheetByName(CONFIG.SHEETS.MTA_MASTER);

  if(!mtaSheet){ Logger.log(CONFIG.SHEETS.MTA_MASTER + " 시트를 찾을 수 없습니다."); return; }

  function normId(v){ return String(v || "").trim(); }

  const mtaById = {};
  sheetToObjects(mtaSheet).forEach(function(r){
    const id = normId(r["Lead ID"]);
    if(!id) return;
    if(!mtaById[id]) mtaById[id] = [];
    mtaById[id].push(r);
  });

  function fmt(d){
    return d instanceof Date && !isNaN(d.getTime())
      ? Utilities.formatDate(d, CONFIG.DATE.TIMEZONE, "yyyy-MM-dd")
      : "(공란)";
  }

  STALE_LEAD_IDS.forEach(function(leadId){

    const rows = (mtaById[leadId] || []).slice().sort(function(a, b){
      const da = a["MTA Created Date"] instanceof Date ? a["MTA Created Date"].getTime() : 0;
      const db = b["MTA Created Date"] instanceof Date ? b["MTA Created Date"].getTime() : 0;
      return da - db;
    });

    Logger.log("========== " + leadId + " (MTA_Master 터치 " + rows.length + "건) ==========");

    if(rows.length === 0){
      Logger.log("  MTA_Master에 이 Lead ID의 터치 자체가 없음");
      return;
    }

    rows.forEach(function(r, i){
      Logger.log(
        "  [" + (i + 1) + "] MTA Created Date=" + fmt(r["MTA Created Date"]) +
        " / Lead Priority=\"" + r["Lead Priority"] + "\"" +
        " / Campaign=" + (r["MKT UTM Campaign"] || "")
      );
    });

  });

}
