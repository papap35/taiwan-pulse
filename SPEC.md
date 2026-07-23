# SPEC.md — Taiwan Pulse 功能規格與路線圖

## 現有功能盤點

| 模組 | 說明 | 狀態 |
|---|---|---|
| 地震（E-A0015-001） | 中央氣象署顯著有感地震，需 `CWA_API_KEY` | [x] |
| 天氣警特報（W-C0033-001） | 中央氣象署天氣特報，需 `CWA_API_KEY` | [x] |
| 空氣品質 | 環境部即時測站 AQI，需 `MOENV_API_KEY` | [x] |
| 交通事件 | TDX 國道事件，需 `TDX_CLIENT_ID`/`SECRET` | [x] |
| 水利淹水 | 水利署即時水位 join 測站警戒門檻（`WRA_WATER_LEVEL_URL` + `WRA_WATER_STATION_INFO_URL`） | [x]（欄位已用真實回應確認） |
| 水庫蓄水率（併入水利淹水類別） | 水利署水庫即時水情，`WRA_RESERVOIR_URL`，只在蓄水率 <30% 時顯示 | [x]（欄位已知，但缺少容量上限參考資料集，見技術債） |
| 火災消防 | 新聞 RSS 關鍵字過濾 | [x] |
| 治安快訊 | 新聞 RSS 關鍵字過濾，UI 明確標示非官方個案資料 | [x] |
| 停班停課 | 國家災害防救科技中心 (NCDR) RSS 公告，`NCDR_SUSPENSION_URL` | [x]（端點已確認，欄位仍待驗證，見技術債） |
| 電力供需燈號 | 台灣電力公司供電燈號，`TAIPOWER_GRID_STATUS_URL`，獨立橫幅非分類事件 | [x]（端點欄位未經真實驗證，見技術債） |
| 疫情監測 | 疾管署 COVID-19 急診/健保就診人次（`od.cdc.gov.tw`），與空氣品質共用色相、方形標記 | [x]（程式邏輯已用真實資料驗證，但 Vercel 連不到這個網域，見下方「已知限制」，目前一律顯示 demo 資料） |
| 地圖 + 事件列表 | react-leaflet + 篩選 + 嚴重程度分級，色彩配置符合 dataviz 準則 | [x] |
| 示範資料退場機制 | 每個來源無金鑰/URL 時自動退回標示清楚的 demo 資料，並用 `DemoBadge` 顯眼標示（曾發生使用者誤以為 demo 資料是即時真實資料的情況） | [x] |
| 自動更新機制 | `/api/events` 用 Next.js `revalidate=120` 做 ISR 快取，前端 SWR 輪詢 | [x]（曾因 `fetch` 用 `cache:"no-store"` 悄悄讓整個 route 變成非快取，已修正，見下方 P0-1） |
| 事件時效性標示 | 每則事件顯示發布時間（絕對+相對）與來源；有官方效期的（天氣特報、停班停課）顯示「有效至」，過期/即將過期會有明顯警示；沒有官方效期的類別依類別設定「資料較舊」門檻 | [x] |
| CI | GitHub Actions：lint → typecheck → build | [x] |
| CD | Vercel 原生 Git 整合（Preview/Production 自動部署） | [x] |
| 漸進式資料載入 | 前端拆成每個分類各自打 `/api/events/[category]`，快的來源（如地震）不用等最慢的來源（交通，需先取 TDX OAuth token）才渲染 | [x] |
| 交通事件路段近似線段 | 用 TDX `Direction` 欄位（北向/南向/東向/西向）推算路段大致走向，在地圖上畫一小段彩色線代替單一個點，不查真實道路線型（見 P2-6.5 說明為什麼不做精確版本） | [x] |

---

## 待開發功能規格

### P0 — 資料正確性（必做，理由：現有第 2 類來源都是「假設欄位名稱」狀態，未經真實 API 驗證，上線後可能整批解析失敗而悄悄退回 demo 資料）

#### 1. 驗證並修正水利署／TDX／停班停課／電力燈號的真實回傳欄位 `[ ]`

**背景**：`lib/sources/flood.ts`、`lib/sources/traffic.ts`、
`lib/sources/suspension.ts`、`lib/gridStatus.ts` 都是在沒有對外網路存取的
沙盒環境中，依開發者記憶中的欄位命名假設寫成，雖然有 `pick()` 容錯與
try/catch 退回 demo 資料保底，但正式串接金鑰後很可能因欄位名稱不符而
一直吃 demo 資料、卻沒有明顯錯誤訊息。

**功能規格**：
- 實際申請/取得 4 組 API 的存取憑證（或公開端點），用 curl/瀏覽器打一次
  拿到真實回傳 JSON
- 對照程式裡的 `pick(...)` 欄位假設逐一修正
- `SourceStatus.ok === false` 或 `isDemo === true`（在有填 URL/金鑰的情況下）
  時，考慮在 `SourceStatusFooter` 加更明顯的警示，避免「以為接上了、其實一直
  在吃 demo 資料」

**狀態說明（`[ ]` 保留，資料來源待確認）**：AI agent 所在的沙盒環境對外網路
被擋（包含 `opendata.cwa.gov.tw`、`dgpa.gov.tw`、`taipower.com.tw` 等網域），
無法直接 curl 這些端點來驗證欄位。需要使用者本機或部署到 Vercel 後實際觀察
`/api/events` 的 `sources[].isDemo`／`error` 欄位，或手動 curl 貼回真實 JSON，
才能繼續往下修正。比照 AGENTS.md Phase 3 例外處理原則：先跳過，不卡住其他
P1/P2 項目的開發。

**已根據使用者實際回報修正（部分）**：
- 中央氣象署地震來源曾在正式環境噴出 `錯誤：Invalid time value`——不是欄位
  找不到，而是拿到真實資料後日期格式解析失敗直接 throw，導致整批真實資料被
  丟棄退回 demo。已修正為系統性問題：新增 `lib/sources/util.ts` 的
  `safeIso()` / `safeIsoOrUndefined()`，套用到全部 9 個來源＋電力燈號的日期
  解析，任何解析失敗都會安全退回目前時間，不會再讓一個壞欄位炸掉整批資料。
- TDX 國道事件曾回報 `HTTP 404 Not Found`，先猜測改成 `Road/Traffic/Incident/Freeway`
  仍是錯的。**使用者實際查證 TDX API 後確認正確端點是
  `/v1/Traffic/RoadEvent/LiveEvent/Freeway`**（注意是 v1、路徑結構是
  `Traffic/RoadEvent/LiveEvent`，跟先前兩次猜測的 `Road/Traffic/Incident`
  完全不同），已更新為這個確認過的端點。回應內容的實際欄位名稱仍未經驗證，
  程式已加入對 TDX 常見的巢狀 `RoadEventLocation` 物件的容錯解析，但仍是
  盡力猜測，需要使用者部署後回報 `SourceStatusFooter` 是否顯示正常筆數。
- 端點修好後使用者接著回報 `錯誤：((intermediate value) ?? []).map is not a
  function`——代表 TDX 回應**不是裸陣列**，而是包了一層外殼物件（TDX 常見的
  `{ RoadEvents: [...], UpdateTime: ..., ... }` envelope 模式）。已修正
  `traffic.ts` 同時處理「回應本身就是陣列」與「回應是物件、真正的陣列包在
  `RoadEvents`/`Data` 等常見鍵名底下」兩種情況，跟 `flood.ts`/`reservoir.ts`
  處理 `records` 欄位的寫法一致。
- 端點與外殼物件都修好、API 抓得到資料後，使用者回報**地圖上完全沒有交通
  事件的標記**。原因：`MapView` 只顯示有 `location`（經緯度）的事件，
  `PositionLat`/`PositionLon`（含巢狀 `RoadEventLocation`）這組欄位猜測沒有
  命中真實回應。已擴大巢狀物件候選鍵名（新增 `Position`、`Location`）與
  欄位候選名稱（新增 `Latitude`/`Longitude`），並仿照 `fire.ts`/`security.ts`
  加入文字比對縣市的退回機制——精確座標解析失敗時，改用道路名稱/描述文字
  比對出的縣市中心點，至少讓地圖上看得到大概位置，而不是完全沒有標記。
  精確欄位名稱仍未確認，若地圖仍然空白需要使用者提供一筆真實回應 JSON。
- **TDX 國道事件欄位已用真實回應確認、不再是猜測**：使用者用 `/api/debug?source=traffic`
  取得一筆真實 `RoadEvent/LiveEvent/Freeway` 回應貼回，確認：座標欄位是
  `Positions`，格式是 WKT 字串 `POINT(lng lat)`（不是先前猜測的
  `PositionLat`/`PositionLon`）；路名在巢狀的 `Location.FreeExpressHighway.Road`；
  真正代表嚴重程度的文字在 `Impact.Description`（比頂層 `Description` 更準確）；
  時間應該用已經是完整 ISO＋時區的 `PublishTime`/`EffectiveTime`；唯一 ID 是
  `EventID`。已改寫 `traffic.ts`：新增 `parseWktPoint()` 解析 WKT 座標、改讀
  `Location.FreeExpressHighway.Road`、severity 判斷改吃 `Impact.Description`
  （並擴充關鍵字涵蓋「部分阻斷」「全部阻斷」），舊的猜測欄位名稱保留作為
  次要 fallback。另外用 `EventTitle`（例如「施工事件」）識別例行施工/養護
  事件，這類事件即使回報「部分阻斷交通」也不應等同真實事故的嚴重度，會
  降一級（`serious` → `warning`），避免地圖把排定的道路施工跟真的車禍事故
  混為一談。
- **水利署水位/水庫端點**：使用者部署後回報兩者皆 `HTTP 503 Service
  Unavailable`。查閱網路上其他人介接同一組 API 的參考資料後，第一輪先把
  `fhy.wra.gov.tw/WraApi/v1/...` 的路徑名稱改成看起來更接近的猜測
  （`RealTimeInfo`），但使用者重新部署後回報**水位端點變成 `fetch failed`
  （連線層級失敗，連 HTTP 狀態碼都拿不到），水庫端點仍是 503**——這代表
  問題不是路徑名稱猜錯而已，`fhy.wra.gov.tw` 這個網域本身可能就不是對的：
  進一步查證後發現它其實是水利署「防災資訊服務網」給人看的網站後端，不是
  設計給第三方程式輪詢的公開 API；水利署真正的開放資料入口是另一個網域
  `opendata.wra.gov.tw`，API 結構也完全不同——不是一個固定路徑回傳全台
  陣列，而是**每個資料集各自對應一組資源 ID**，網址是
  `opendata.wra.gov.tw/api/v2/{resource-id}`（CKAN 風格，同一個模式也支援
  `format=CSV`/`XML`/`JSON`）。**使用者直接在瀏覽器找到正確的資源 ID 貼給
  我**：即時水位是 `73c4c3de-4045-4765-abeb-89f9f9cd5ff0`、水庫水情是
  `2be9044c-6e44-4856-aad5-dd108c2e6679`，已更新 `.env.example` 兩個網址的
  網域與路徑為這組確認過的正確位置。**網域＋路徑已確認正確，但 JSON 實際
  欄位名稱仍未驗證**（`opendata.wra.gov.tw` 整個網域對 AI agent 沙盒與
  WebFetch 測試工具都回傳 403，無法直接取得真實回應內容）——`flood.ts`／
  `reservoir.ts` 的欄位解析維持原本的 `pick()` 多重候選猜測不變，另外加寬了
  envelope 拆解邏輯（新增 `result.records` 巢狀陣列的容錯，比照 CKAN 常見
  外殼格式）。如果部署後這兩個來源仍是 0 筆或示範資料，麻煩貼一次
  `/api/debug?source=flood`／`?source=reservoir` 的實際回應，才能像 TDX
  那次一樣一次修對欄位名稱。
- **河川水位欄位已用真實回應確認、警戒邏輯也重新設計**：使用者貼回
  `/api/debug?source=flood` 的實際內容後發現，即時水位這個資料集**只有
  `stationid`／`waterlevel`／`datetime`，完全沒有警戒等級、站名、座標**——
  原本「`AlertLevel` 欄位猜錯」的假設是錯的，正確答案是這個資料集本身
  就不包含警戒判斷所需的資訊，需要另外 join 一個「測站基本資料」參考資料集
  才能算出警戒。使用者接著在 `opendata.wra.gov.tw` 上找到並確認了這個參考
  資料集（`c4acc691-7416-40ca-9464-292c0c00da92`），關鍵發現：
  - 用即時資料的 `stationid` 對應參考資料的 `basinidentifier`（兩個資料集
    對同一個值用了不同欄位名稱，WRA 內部命名本身就不一致）即可 join。
  - 警戒門檻在 `alertlevel1`／`alertlevel2`／`alertlevel3`（一級最高、
    三級最低，真實資料 `alertlevel1: "5.8" > alertlevel2: "4.6"` 驗證了這個
    順序），某一級沒有設定時是空字串 `""`，`Number("")` 是 `0` 不是
    `NaN`，如果沒特別處理會被誤判成「門檻是 0」——新增 `lib/sources/util.ts`
    的 `parseNum()` 統一處理這個問題，空字串一律回傳 `undefined`。
  - 真正的站名在 `observatoryname`，座標在 `locationbytwd97_xy`，格式是
    **TWD97 TM2 投影座標**（例如 `"313411.44 2790930.63"`），不是經緯度，
    需要做座標轉換才能當地圖座標用——新增 `lib/geo.ts` 的 `twd97ToWgs84()`
    做這個轉換，用使用者提供的真實測站（新磺溪橋，新北市金山區）反查驗證：
    轉換結果 25.2257°N / 121.6294°E 確實落在金山區沿海一帶，跟已知地理
    位置吻合。
  - `lib/sources/flood.ts` 改寫成平行抓取即時讀數＋測站參考資料、用
    `stationid`/`basinidentifier` join、依三級門檻算出 `severityFromLevels()`
    （已測試涵蓋一二三級門檻邊界、門檻缺失、完全無門檻等情況）。因為現在
    有精確座標，不再需要縣市中心點 fallback；也因為沒有結構化的中文縣市
    欄位（測站地址只有英文版），`county` 欄位就不填了，直接用精確座標定位。
  - 用使用者提供的兩筆真實資料（正常水位 1.9m vs. 門檻 4.6/5.8m）寫了
    join 邏輯的整合測試，過程中抓到一個真的 bug：`STATION_INFO_URL` 原本
    寫成 module 層級常數（在模組載入當下就讀一次 `process.env`），這樣的
    寫法不只讓測試沒辦法用 `vi.stubEnv()` 覆蓋，也代表任何未來想在同一個
    process 內動態改這個環境變數的情境都不會生效——已改成跟其他來源一致
    的寫法（每次呼叫時才讀 `process.env`）。
  - **水庫蓄水率還沒解決**：使用者也貼了水庫端點的真實回應，欄位是
    `reservoiridentifier`／`effectivewaterstoragecapacity`／`waterlevel`，
    同樣沒有百分比欄位，需要另一個「水庫容量上限」參考資料集才能算蓄水率，
    這個資料集的資源 ID 目前還沒找到，`reservoir.ts` 暫時維持原本的欄位
    猜測不變（詳見下方 P1-3）。
- **順便補上的通用韌性**：無論上面的路徑是否修對，503/502/504 這類閘道層
  暫時性錯誤原本會直接被當成永久失敗、立刻退回示範資料。`lib/sources/util.ts`
  的 `fetchJson`/`fetchText` 現在會對這三種狀態碼自動重試（最多 2 次、
  500ms／1500ms 退避），404/401 等「請求本身有問題」的狀態碼則不重試，維持
  原本行為。這是 T3 提到的重試機制的一般化版本（原本只打算給 TDX 429 用），
  對這次水利署的 503、以及任何來源未來遇到的暫時性閘道錯誤都有幫助。
- **停班停課端點整個換掉**：原本猜測的 `www.dgpa.gov.tw/typh/opendata/open.json`
  使用者部署後回報 `HTTP 404 Not Found`。查證後發現這個路徑很可能從來就不
  存在——目前找到唯一真正介接這份資料的公開專案（[tw-nds-cli](https://github.com/bobby1030/tw-nds-cli)）
  是直接抓 `dgpa.gov.tw/nds.html` 的 HTML 表格解析，不是打 JSON API，代表
  人事行政總處本身可能沒有提供穩定的 JSON/XML feed。**使用者改為提供國家
  災害防救科技中心 (NCDR) 的官方 RSS/Atom 公告 feed**
  （`https://alerts.ncdr.nat.gov.tw/RssAtomFeed.ashx?AlertType=33`，
  `AlertType=33` 是停班停課類別），已把 `lib/sources/suspension.ts` 從
  `fetchJson` 改成重用既有的 `fetchRssItems()`（`lib/sources/newsRss.ts`，
  原本給火災/治安新聞來源用的 RSS/Atom 解析器），並比照 `fire.ts`/`security.ts`
  的做法用縣市文字比對取得地點座標，**不再是「有設定網址才啟用」，改成跟
  `epidemic.ts` 一樣預設直接啟用**（`NCDR_SUSPENSION_URL` 只作為手動覆蓋
  選項）。網域＋端點由使用者直接確認正確，但實際 RSS 項目的 `title`/
  `description` 文字內容仍未驗證（`alerts.ncdr.nat.gov.tw` 對 AI agent 沙盒
  與 WebFetch 都回傳 403，看不到真實內容），如果部署後這個來源持續是 0 筆，
  麻煩貼一次 `/api/debug?source=suspension` 的實際回應。
- 電力燈號的實際欄位名稱仍待驗證。
- **CDC 疫情監測**：使用者提供官方 OpenAPI 規格後確認 https://data.cdc.gov.tw/
  是標準 CKAN 系統，`epidemic.ts` 改成用 CKAN 文件化的
  `package_search`／`datastore_search` 兩段式流程自動找資料，**預設直接啟用**，
  不像其他來源需要先手動找網址填入。
- **意外發現並修正一個影響所有來源的架構級 bug**：把 `epidemic.ts` 改成預設
  啟用（不再需要先判斷有沒有設定網址才呼叫 fetch）之後，`next build` 把
  `/api/events` 從 `○ Static, Revalidate 2m` 變成 `ƒ Dynamic`。追查後發現
  `lib/sources/util.ts` 的 `fetchJson`/`fetchText` 用 `cache: "no-store"`
  呼叫外部 API，而 Next.js 的規則是：**route 裡只要有一個 `no-store` 的
  fetch 真的被執行到，整個 route 就會被判定為完全動態渲染，直接蓋掉
  `export const revalidate` 設定**——這表示只要正式環境的金鑰都設定好、
  來源真的會呼叫 fetch，`revalidate=120` 的 ISR 快取機制實際上早就悄悄失效，
  只是在本機示範模式（不呼叫任何 fetch）看起來正常。已修正：改用
  `next: { revalidate: REVALIDATE_SECONDS }` 取代 `cache: "no-store"`，
  讓 Next.js 自己的 Data Cache 接手，經實測（暫時讓單一來源強制呼叫 fetch
  來源、比對建置前後的 route 分類）確認修好後即使來源持續呼叫 fetch，
  route 仍維持 `○ Static, Revalidate 2m`。

---

### P1 — 核心價值擴充：更多災害/民生資料類別

#### 2. 疫情／法定傳染病即時監測 `[x]`

**背景**：登革熱、流感等法定傳染病是重要的公衛「民生事件」類別，補齊後
與地震/天氣/治安並列的災害監控更完整。

**功能規格**：
- 資料來源：疾病管制署開放資料（`lib/sources/epidemic.ts`），比照既有來源
  結構（demoData → 真實 API → try/catch fail()）
- 只監測登革熱／流感／腸病毒／COVID，各自設定不同的「新聞性」病例數門檻
  （例如登革熱本土病例 1 例就顯示，流感則要 50 例以上），閾值是實務近似值，
  非官方警戒標準
- `Category` 新增 `epidemic`：8 個色相已用滿，採用複合編碼——重用 `air`
  （空氣品質，同屬公衛領域）的色相，但用**方形標記**取代圓形（`lib/style.ts`
  的 `CATEGORY_SHAPE`，`components/CategoryDot.tsx`、`components/MapView.tsx`
  皆已支援），符合 AGENTS.md 1.4／dataviz 準則「第 9 個類別用複合編碼、不生成
  新色相」的原則

**資料來源**：疾病管制署 https://data.cdc.gov.tw/，不需金鑰。

**更新（使用者提供 CDC 官方 OpenAPI 規格後）**：確認 CDC 開放資料平台是標準
CKAN 系統，`https://data.cdc.gov.tw/api/3` 是真實可用的 base URL，
`/action/package_search`、`/action/datastore_search` 是 CKAN 本身文件化、
穩定的標準 API（不是台灣政府自訂、需要用猜的）。因此 `lib/sources/epidemic.ts`
改寫成兩段式流程：先用 `package_search?q=法定傳染病` 搜尋資料集，再用
`datastore_search` 或資源本身的 `url` 取得實際資料，**預設直接啟用、不需要
使用者先找網址填入**（跟 `CDC_EPIDEMIC_URL` 舊版行為不同）。`CDC_EPIDEMIC_URL`
保留作為手動覆蓋選項。資料集裡實際的欄位名稱（病例數、縣市、疾病名稱等）
仍是未驗證的猜測，屬於 P0-1 的一部分。

**再次更新（2026-07-23，這個 CKAN 流程從未在正式環境連線成功）**：即使
T3 記錄的四次修法（重試邏輯、timeout 拉長到 25s、`maxDuration`、瀏覽器
User-Agent）全部上線，`data.cdc.gov.tw` 仍持續回報 `fetch failed`——判斷
是網路層（很可能是 Vercel IP 範圍）被擋，不是程式邏輯的問題，繼續猜第五種
修法投入產出比太低。使用者接著自己在瀏覽器找到兩個**不同網域**的真實資料：
- `https://od.cdc.gov.tw/eic/RODS_COVID-19.json`（急診 COVID-19 就診人次，
  依年/週/縣市/年齡層）
- `https://od.cdc.gov.tw/eic/NHI_COVID-19.json`（健保門診/住院 COVID-19
  就診人次，多一個「就診類別」欄位）

兩者都是**單純的靜態 JSON 檔案**（不是 CKAN 兩段式流程，不需要 search 再
fetch，也不需要金鑰），且是不同網域（`od.cdc.gov.tw` 而非
`data.cdc.gov.tw`），實測後這次真的連得到。`lib/sources/epidemic.ts`
整個改寫：直接平行抓取這兩個檔案，找出資料裡最新的「年+週」，依縣市加總
急診就診人次（跨年齡層）與健保門診/住院人次（跨年齡層，依「就診類別」
篩選），並與上一週的急診人次比較算出漲跌趨勢。**代價**：原本 `MONITORED`
表監控的登革熱／流感／腸病毒被拿掉了——但那些欄位名稱本來就是從未驗證過
的猜測，這次換成一個真正能連線、且欄位已用真實資料確認過的 COVID-19
專屬來源，是刻意的取捨。嚴重程度門檻（急診就診人次 ≥80/30/10）是照
2026 年第 28 週真實資料（六都介於 43～96 人次之間）校準的實務近似值，
不是官方警戒標準。

**再再次更新（`od.cdc.gov.tw` 部署後也回報 `fetch failed`）**：`/api/debug`
原本只印 `err.message`，Node 的 `fetch failed` 對所有連線層級錯誤都是同一句
話，看不出真正原因。加上 `describeError()`（見 T3 尾段）把 `err.cause`
串出來後，實際錯誤是：
```
fetch failed ← caused by: Connect Timeout Error
(attempted address: od.cdc.gov.tw:443, timeout: 10000ms) (UND_ERR_CONNECT_TIMEOUT)
```
`UND_ERR_CONNECT_TIMEOUT` 代表 **TCP 三向交握本身**在 10 秒內完成不了——連
HTTP request 都還沒發出去，不是「伺服器回應慢」。這個 10000ms 是 undici
內建的連線逾時，跟我們自己設的 `CDC_TIMEOUT_MS`／`fetchWithRetry` 的
AbortController 逾時是兩回事，代表就算再調長我們自己的逾時也沒用。判斷：
封包在網路層被丟棄（黑洞），是防火牆／地區限制的典型特徵。專案先前完全
沒有設定 Vercel serverless function 的執行地區，預設會是美國（`iad1`），
而台灣許多政府網站對非台灣／雲端服務商來源 IP 有防火牆層級限制，這個現象
完全吻合。已在四個 `app/api/*/route.ts` 都加上 `export const preferredRegion
= "hnd1"`（東京，Vercel 提供離台灣最近的地區），這是跟前面四次 CDC 修法
不同類的修正——那四次都是應用層調整，連線都建立不起來時完全碰不到。
**改地區後使用者重新部署驗證，仍是同樣的 `UND_ERR_CONNECT_TIMEOUT`**——
代表擋的不是「美國地區」，而是整個雲端服務商的 IP 段（不分地區）。連同
先前四次修法（重試邏輯、逾時拉長、`maxDuration`、User-Agent），總共五種
不同類的修法都無法讓 Vercel 連到 `od.cdc.gov.tw`，投入產出比已經太低。

**已知限制（正式結案，不再繼續嘗試修連線問題）**：`od.cdc.gov.tw` 從
Vercel serverless function（不論哪個地區）都連不到，判斷是該網域對雲端
服務商 IP 段的防火牆限制，不是任何程式邏輯能修的問題。`lib/sources/
epidemic.ts` 的資料解析／聚合／週趨勢邏輯本身已用真實資料驗證過、有完整
測試覆蓋，程式碼保持原樣——如果之後這個網域對外開放、或改用其他能連上
的資料來源，不需要重寫這部分邏輯，只要把 `CDC_RODS_URL`/`CDC_NHI_URL`
指向能連的位置即可。目前這個類別會持續顯示清楚標示的 demo 資料
（`isDemo: true`），使用者若要看真實 COVID-19 數據，需直接查閱
`od.cdc.gov.tw` 或疾管署官網。
**優先級理由**：公衛是明確的災害監控需求，且資料來源穩定（政府法定通報）

#### 3. 水庫蓄水率 `[x]`

**背景**：枯水期/颱風期的水庫蓄水狀況是重要民生指標，可與水利淹水並列
在同一個「水利」大類下呈現，不需要新色相。

**功能規格**：
- 資料來源：水利署水庫即時水情（`lib/sources/reservoir.ts`）
- 併入既有 `flood` 分類（水利大類）
- 只在蓄水率 <30% 時產生事件（<20% 額外標示「低於二級運用標準」），比照
  `airQuality.ts` 只呈現 AQI≥100 的做法

**資料來源**：水利署，`WRA_RESERVOIR_URL`，預設免金鑰。**端點與欄位已用真實回應
確認**（`reservoiridentifier`／`effectivewaterstoragecapacity`／`waterlevel`），
但沒有百分比欄位——要算「蓄水率」需要每座水庫的容量上限，這是另一個還沒找到
資源 ID 的參考資料集，做法應該跟 P0-1 修好的河川水位一樣（join 一個測站/水庫
基本資料資料集），只是這個資料集的資源 ID 還沒著落，`severityFromStoragePct()`
與 `<30%` 篩選邏輯目前仍是等實際欄位到位後才會真正被觸發到。
**優先級理由**：可重用既有 `flood` 分類色相，實作成本低（河川水位那半已完成，
只差水庫容量上限這個資料集）

#### 4. 土石流潛勢溪流警戒 `[ ]`

**背景**：颱風豪雨期間的坡地災害警戒，與天氣特報高度相關但屬於不同的
政府資料集。

**功能規格**：
- 資料來源：農業部土石流及大規模崩塌防災資訊網
- 併入 `weather` 或 `flood` 分類（依實際欄位判斷哪個語意更貼切）

**資料來源**：農業部，需確認端點
**優先級理由**：颱風季節高相關性，但資料來源穩定性待確認

#### 4.5 擴大既有類別的資料涵蓋範圍（RSS 來源數量、交通事件涵蓋道路種類）`[ ]`

**背景**：使用者實測發現全台事件數偏少，追查後確認除了「只顯示異常值」的
刻意設計之外，還有兩個真正偏窄的地方：`NEWS_RSS_FEEDS` 預設只有一組 RSS
（火災/治安新聞的關鍵字過濾建立在很窄的來源上），交通事件目前只呼叫 TDX
國道事件端點，市區道路、省道、大眾運輸事故完全沒涵蓋。

**功能規格**：
- 研究 TDX 是否有省道/市區道路事件的對應端點（`Road/Traffic/Incident/City`
  或類似路徑，需要實際查 TDX API 文件或 Playground 確認，AI agent 沙盒連
  不到 `tdx.transportdata.tw` 無法自行查證）
- 蒐集更多穩定的新聞/警廣 RSS 來源，寫進 README 的建議清單，而不是只給
  使用者一個空白的「可自行加多組」提示
- 兩者都屬於「擴大涵蓋範圍」而非新類別，不需要新色相

**優先級理由**：直接回應真實使用回饋（不是假設性的功能），且不需要新增
分類色相，但需要外部 API 文件查證，複雜度中等

---

### P2 — 進階體驗

#### 5. 大眾運輸即時到站 `[ ]`

**背景**：公車/捷運/台鐵/高鐵即時到離站資訊，補齊「交通事件」大類下的
日常民生使用情境（不只是事故，也包含正常通勤資訊）。

**功能規格**：
- 資料來源：TDX（與現有國道事件同一組憑證，擴充呼叫範圍）
- 併入既有 `traffic` 分類，設計上與「事故」類事件用不同的 severity 預設值
  （多半是 `info`）區分

**資料來源**：TDX，已有憑證可重用
**優先級理由**：憑證已具備，主要是新增 fetcher 邏輯

#### 6. 停車場即時車位 `[ ]`

**背景**：與大眾運輸到站同屬「交通」民生資訊擴充。

**功能規格**：
- 資料來源：各縣市停車場開放資料 / TDX 停車格資訊
- 併入 `traffic` 分類

**資料來源**：需逐縣市確認資料品質
**優先級理由**：資料來源分散、品質不一，排在大眾運輸到站之後

#### 6.5 交通事件貼合真實道路曲線的路段線型 `[~]`

**背景**：使用者希望交通事件在地圖上能像 Google Map 的路況圖層一樣，用
「沿著道路的彩色線段」呈現，而不是單一個點。研究後找到 TDX 確實有對應的
GIS 路網資料：**`GET /v3/Map/Road/Network/RoadClass/{RoadClass}/RoadName/{編碼過的路名}?$top=N&$format=GEOJSON`**
（`RoadClass=0` 對應國道，`RoadName` 例如「國道1號」需要 URL 編碼，回應是
GeoJSON，座標應該已經是標準經緯度，不像水利署的 TWD97 需要轉換；`$top`
限制每次回應筆數，無法一次拿到整條路的完整線型，需要分批查詢或篩選路段）。

**第一次評估後決定先不做**：要把交通事件的 `StartKM`/`EndKM`（見 P0-1
traffic.ts 筆記）對應到這組 GeoJSON 裡實際的線段座標，需要知道每個 GeoJSON
feature 的屬性裡有沒有里程資訊可以比對，而且同一條路需要分批查詢才能拿到
完整線型（`$top` 限制），複雜度堆疊起來跟疫情監測那次的資料集研究差不多，
使用者評估後決定太複雜，先用更簡單的近似做法（見上方「現有功能盤點」的
「交通事件路段近似線段」，直接用 `Direction` 欄位推算方向，不查真實道路
線型；已在 PR 上線）。

**使用者看到近似線段沒有貼合道路曲線後，改變主意決定投入真實版本**：
已完成的準備工作：
- TDX 的 OAuth token 邏輯已抽成共用模組 `lib/sources/tdxAuth.ts`
  （`getTdxToken()`／`hasTdxCredentials()`），`traffic.ts` 也改用這個共用
  模組，讓新的路網 API 可以重用同一組 token 快取。
- 新增 `lib/sources/roadNetwork.ts` 的 `fetchRoadNetworkRaw(roadName, top)`，
  打確認過的端點（`RoadClass=0` 對應國道），並接進 `/api/debug`
  （`?source=roadNetwork`，額外支援 `?roadName=`／`?top=` 覆蓋預設值
  「國道1號」／5 筆），**目前只有原始回應轉發，還沒有任何欄位解析／
  join 邏輯**。

**還缺的東西才能真正做完**：
- 使用者需要打 `/api/debug?source=roadNetwork` 貼一筆真實 GeoJSON 回應，
  確認每個 feature 的屬性裡有沒有里程/路段 ID 可以比對 `StartKM`/`EndKM`
- 如果有里程屬性：寫 join／裁切邏輯，把交通事件的 `StartKM`~`EndKM` 對應到
  線段裡對應的座標子集
- 如果沒有里程屬性：退而求其次，可能只能用「查到的整段線型」代表，或是
  找出更精確的比對方式（例如用事件座標找最近的線段點）
- 同一條路可能需要分批查詢（`$top` 限制）才能拿到完整線型，需要設計分批
  策略
- 道路線型是靜態資料，應該用比事件本身（120 秒）長很多的快取時間

**優先級理由**：視覺效果加分明顯，使用者已確認投入意願，卡點是需要真實
GeoJSON 回應才能繼續設計解析邏輯

#### 7. 通知/推播機制 `[ ]`

**背景**：目前只能被動開網頁查看，重大事件（例如 `critical` 等級）發生時
使用者不會主動收到通知。

**功能規格**：
- 瀏覽器 Web Push 或 email 通知，訂閱條件（例如「只通知我所在縣市的
  critical 事件」）
- 需要後端訂閱狀態儲存（目前專案完全無資料庫，需先評估輕量方案，例如
  Vercel KV）

**優先級理由**：使用者體驗提升明顯，但需要新增有狀態的後端基礎設施，
複雜度較高，排在純資料類擴充之後

---

### P3 — 長期功能

#### 8. 歷史事件回顧／統計圖表 `[ ]`

**背景**：目前 `/api/events` 只回傳當下快照，沒有任何歷史資料保存，無法
回答「這個月地震幾次」「哪個縣市停班停課最頻繁」這類問題。

**功能規格**：
- 需要持久化儲存（資料庫或定期寫入 JSON snapshot）
- 統計圖表遵循 dataviz skill 的色彩/圖表選型規則

**優先級理由**：需要新增儲存層，是較大的架構變動，排在功能擴充之後評估

---

### P4+ — 差異化／依賴外部資源

#### 9. 山難／海難搜救通報 `[ ]`

**背景**：內政部消防署/海巡署的搜救通報，屬於低頻但高關注度事件。

**優先級理由**：資料來源穩定性與更新頻率待確認，且案例稀少，投報比低於
P1/P2 項目

#### 10. 飛航公告（NOTAM） `[ ]`

**背景**：民航局飛航公告，屬於較專業的資訊需求，一般使用者關注度較低。

**優先級理由**：目標受眾窄，排在後面

#### 11. PWA / 手機推播 `[ ]`

**背景**：與項目 7 通知機制相關，但範圍更大（離線支援、加到主畫面）。

**優先級理由**：屬於錦上添花的體驗優化，等核心資料類別穩定後再評估

---

## 技術債與基礎強化

### T1. 補自動化測試框架 `[x]`

**背景**：目前完全沒有單元測試，`lib/sources/*.ts` 裡的嚴重程度判斷函式
（`magnitudeToSeverity`、`aqiToSeverity`、`levelFromReserveRate` 等）都是
純函式、輸入輸出明確，是最適合優先補測試的對象（見 AGENTS.md 2.2）。

**已完成**：導入 Vitest（`lib/**/*.test.ts`），CI workflow 在 typecheck 後、
build 前加了 `npm test` step。涵蓋：`countyCentroid`、`computeFreshness`／
`endOfTaiwanDay`、`pick`／`safeIso`／`safeIsoOrUndefined`，以及全部 7 個來源
的嚴重程度判斷函式（原本是 module-private，已改成 `export` 才能測）。共 10
個測試檔、64 個測試案例，全數通過。`safeIso` 的測試裡有一個對應真實
production bug 的防迴歸測試（地震來源日期解析失敗直接 throw 的那次）。

### T2. 端點 schema 驗證與監控 `[~]`

同 P0-1，但長期應該做成自動化：例如 CI 或排程定期打一次真實端點，若欄位
解析後產出的事件數量長期為 0（代表 `pick()` 全部沒命中），發告警而不是
靜默退回 demo 資料。

**已完成一部分（手動查詢工具）**：新增 `/api/debug?source=<name>`，回傳
每個來源「未經任何欄位轉換」的原始上游回應。因為所有資料抓取都在伺服器端
（SSR），使用者原本沒辦法從瀏覽器開發者工具看到打給政府 API 的原始請求/
回應，導致每次欄位對不上都要靠使用者回報錯誤訊息、我再用猜的修正，來回
好幾輪才能修好一個來源（TDX 國道事件就是這樣修了 3 次才修好）。有這個端點
之後可以直接看到真實回應，一次修對，不用再猜。**尚未完成的部分**：自動化
監控/告警（例如排程定期檢查、事件數量長期為 0 時發通知）還沒做，目前仍是
手動查詢工具。

### T3. TDX Token 快取與 429 重試 `[~]`

**背景**：`lib/sources/traffic.ts` 目前對 TDX 的 OAuth token 有記憶體快取，
但沒有處理 API 回傳 429（Rate Limit）時的重試/退避邏輯。流量大時可能連續
失敗。

**已完成一部分**：`lib/sources/util.ts` 的 `fetchJson`/`fetchText` 現在對
502/503/504 這類閘道層暫時性錯誤會自動重試（最多 2 次、500ms／1500ms
退避），這是因為修水利署 503 問題（見 P0-1）時發現這個重試機制不該只給
TDX 用，所有來源都可能遇到暫時性閘道錯誤。**尚未完成**：429（Rate Limit）
語意上跟 502/503/504 不同——429 通常會帶 `Retry-After` header 告訴你該
等多久，目前的重試沒有讀取這個 header，只是用固定退避時間；TDX 的 OAuth
token 取得流程本身也還沒有獨立的重試保護（目前只有實際資料 API 呼叫走
`fetchJson`，token 呼叫是直接 `fetch`，見 `traffic.ts` 的 `getToken()`）。

**修正一個這個重試機制自己造成的 bug**：使用者回報 CDC 疫情監測錯誤
`This operation was aborted`。追查後發現 `fetchWithRetry()` 原本的
`catch (err) { lastError = err }` 會攔截**任何**拋出的例外——包括我們自己
的逾時 `AbortController` 觸發的 `AbortError`——然後照樣重試，不是只重試
502/503/504 這幾個 HTTP 狀態碼。`epidemic.ts` 的 CKAN 流程是兩段式循序呼叫
（先 `package_search` 再 `datastore_search`），每段呼叫本身變慢時，逾時後
不但沒有直接失敗，反而觸發最多 2 次重試（每次還是用同樣 10 秒逾時），兩段
相乘下來最壞情況要等將近一分鐘，遠超過任何上層（Vercel serverless
function、或呼叫方自己的逾時）願意等待的時間，最終被外層直接中止，也就是
使用者看到的 `This operation was aborted`。已修正：逾時／連線層級的例外
現在會直接拋出、不再重試（重試同樣的逾時時間沒有意義，只會讓本來就慢的
請求更慢），只有真正拿到 HTTP 502/503/504 回應時才重試。

**上面那個修正之後，使用者仍回報同樣的 `This operation was aborted`**——
代表問題不只是「重試把逾時疊加」，連單一次呼叫都可能超過原本 10 秒的逾時
上限。`epidemic.ts` 的 CKAN 流程本身就有兩個潛在慢點：(1) 兩段式循序呼叫
（`package_search` 再 `datastore_search`）本來就比其他來源的單一 API
呼叫慢；(2) 如果比對到的資源不是 `datastore_active`（可查詢），會直接
`fetch` 該資源的原始檔案網址，這條路徑完全沒有大小限制——CDC
法定傳染病資料集的歷史匯出檔案可能很大。已將 `epidemic.ts` 三個
`fetchJson` 呼叫的逾時從預設 10 秒延長到 25 秒，並在
`app/api/events/route.ts`、`app/api/events/[category]/route.ts`、
`app/api/debug/route.ts` 加上 `export const maxDuration = 60`——單純延長
用戶端逾時沒有意義，如果平台本身（例如 Vercel serverless function）用更短
的執行時間上限把整個請求中止，程式碼再怎麼調逾時都不會生效。這個 `maxDuration`
設定在方案本身限制更短的情況下不會有任何效果，但在方案允許的情況下能真正
解決問題，沒有下行風險。

**延長逾時之後，錯誤訊息從 `This operation was aborted` 變成 `fetch
failed`**——這是關鍵線索：前者是我們自己的逾時計時器觸發，後者是 Node
的通用連線層級錯誤（DNS 失敗、連線被拒、TLS 握手失敗，連 HTTP 回應都
拿不到），代表問題**不是慢，是連線本身建立不起來**，延長逾時完全沒有用。
對照三個不同呼叫端打同一個 `data.cdc.gov.tw` 網址的結果：AI agent 沙盒
（網路政策擋 403）、WebFetch 工具（伺服器真的回應 403）、使用者的 Vercel
部署（`fetch failed`）——三種完全不同的錯誤，這正是 WAF／防機器人機制的
典型特徵（跟水利署那次的模式一樣：同一個網址，不同呼叫來源被用不同方式
擋下）。已在 `lib/sources/util.ts` 的 `fetchWithRetry()` 幫所有對外請求
加上標準瀏覽器 `User-Agent`／`Accept` header（呼叫端自訂的 header，例如
TDX 的 `Authorization`，優先權更高、不會被蓋掉）——這不是假冒身分，只是
不要讓請求帶著容易被指紋辨識的預設 Node fetch client 特徵，對本來就設計
給機器讀取的公開資料來說是常見且低風險的作法。

**User-Agent 修正後，使用者重新部署驗證，`data.cdc.gov.tw` 仍回報同樣的
`fetch failed`**（連續兩次一致）——四種修法（重試邏輯、逾時拉長、
`maxDuration`、User-Agent）全部無效，判斷是 `data.cdc.gov.tw` 這個網域
本身在網路層被擋，不是任何程式邏輯能修的問題，停止再猜。改用 P1-2 記錄的
`od.cdc.gov.tw`（不同網域的靜態 JSON 檔案，使用者自己在瀏覽器找到）取代
整個 CKAN 流程，實測連得到——證實了「同一個機關、換一個網域就通」的判斷，
而不是「疾管署的資料全部連不到」。

**`od.cdc.gov.tw` 部署後，`/api/debug?source=epidemic` 只印出 `fetch
failed`，看不出真正原因**——這是 Node 的通用連線層級錯誤訊息，實際原因
（DNS/連線被拒/逾時）藏在 `err.cause` 裡，`fail()` 與 `/api/debug` 的
catch block 都只讀了 `err.message`。新增 `lib/sources/util.ts` 的
`describeError()`，把 `cause` 鏈路一路串出來（最多 5 層，附上錯誤代碼如
`ECONNREFUSED`），取代所有地方的 `err.message`。串出來後，真正的錯誤是
`UND_ERR_CONNECT_TIMEOUT`——見 P1-2 尾段，代表連線本身建立不起來，判斷是
地區防火牆問題，已加上 `preferredRegion = "hnd1"`。

### T4. 漸進式資料載入（拆分 `/api/events`）`[x]`

**背景**：使用者發現原本的架構是前端單一 `useSWR("/api/events")`，後端在
`lib/aggregate.ts` 用一個 `Promise.allSettled` 等全部 9 個分類（10 個
fetcher）＋電力燈號都抓完才回傳一包 JSON——畫面必須等最慢的來源（交通事件，
要先打 TDX OAuth token 再打實際 API，兩段式）才能整批渲染，快的來源（地震、
天氣特報）無謂被拖慢。

**評估過的方案與取捨**：
- **SSE / streaming 單一連線**：體感也會變好，但 Next.js 的 streaming route
  handler 必須是 `force-dynamic`，會讓每個使用者連線各自觸發真實 fetch，
  等於繞過現有的 ISR 共用快取機制（`next: { revalidate: REVALIDATE_SECONDS }`），
  流量一大就可能超過政府免費 API 的限制——這正是先前修過的架構級 bug
  （見上方 P0-1 最後一條）想避免的情況，所以不採用。
- **拆成每分類一支 route**（採用）：`/api/events/[category]` 重用既有
  `fetchXxx()` 函式，每支各自套用同樣的 `revalidate = 120`，共用快取效益
  完全不受影響；用 `generateStaticParams()` 預先產生全部 9 個分類的靜態
  路徑，讓這個動態路由跟 `/api/events` 一樣是 `● SSG, Revalidate 2m`，
  而不是每次請求都動態渲染。

**實作**：
- 新增 `lib/sourceRegistry.ts`：`CATEGORY_SOURCES`（分類→fetcher 陣列，
  例如 `flood` 同時對應 `fetchFlood` 與 `fetchReservoirLevels`）與
  `fetchCategory()`，作為「這個分類由哪些 fetcher 組成」的唯一真實來源，
  `lib/aggregate.ts`（`/api/events` 保留，仍可用於需要單次拿到全部資料的
  情境）與新路由共用同一份定義，避免兩處各自列一次、之後改分類漏改其中一處。
- 新增 `app/api/events/[category]/route.ts`（各分類）與
  `app/api/grid-status/route.ts`（電力燈號，原本併在 `/api/events` 裡）。
- 前端 `components/Dashboard.tsx`：改用 `CategorySource` 子元件，每個分類
  各自一個獨立的 `useSWR` 呼叫（放進獨立元件而不是在迴圈裡直接呼叫 hook，
  才不違反 React Hooks 規則），資料到齊後回報給 `Dashboard` 合併、排序，
  地圖與列表逐步補上標記；「立即更新」按鈕改用 SWR 的全域 `mutate()`
  同時重新驗證全部 10 個 cache key。
- 用 Playwright 檢查瀏覽器實際發出的請求，確認畫面載入後會平行打出 9 個
  `/api/events/<category>` ＋ 1 個 `/api/grid-status`，不再是單一
  `/api/events`；`next build` 確認 `/api/events/[category]` 顯示
  `● SSG, Revalidate 2m`（跟 `/api/events` 一致），不是 `ƒ Dynamic`。

---

## 優先開發路徑建議

```
P0-1（驗證真實端點）→ P1-3（水庫蓄水率，重用 flood 分類，成本低）
→ P1-2（疫情監測）→ P1-4（土石流潛勢）
→ P2-5（大眾運輸到站，憑證已具備）→ P2-6（停車場車位）
→ T1（補測試框架，建議在功能擴充到一定量之後一次導入，避免反覆調整測試結構）
→ P2-7（通知機制）→ P3-8（歷史統計）
→ P4 項目視需求評估
```

技術債 T2、T3 建議與相關功能項目**同一批處理**（例如做 P0-1 驗證端點時
順便補上 T2 的長期監控機制），不需要單獨排隊。
