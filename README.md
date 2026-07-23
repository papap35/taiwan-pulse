# Taiwan Pulse 台灣即時監控

[![CI](https://github.com/papap35/taiwan-pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/papap35/taiwan-pulse/actions/workflows/ci.yml)

整合台灣多項官方開放資料的即時監控儀表板：地震、天氣警特報、空氣品質、交通事件、
水利淹水、火災消防、治安快訊、停班停課、疫情監測，在地圖與列表上即時呈現並依嚴重
程度分級；另外還有一個全國電力供需燈號的小型狀態橫幅。

## 快速開始

```bash
npm install
npm run dev
```

開啟 http://localhost:3000。**不需要任何 API 金鑰即可執行** — 尚未設定的資料來源會
顯示清楚標記為「示範資料」的範例事件，畫面右下角「資料來源狀態」可看到每個來源是
使用真實資料還是示範資料。

## 開發規範與路線圖

- 要新增功能或修 bug 前，先看 [`AGENTS.md`](./AGENTS.md)：架構原則、分支/PR/commit
  流程、每次 PR 前的自我 review 清單。
- 目前已完成的功能與待開發項目（含優先順序）記錄在 [`SPEC.md`](./SPEC.md)。
- 兩份文件的協作方式定義在 [`AI_PROJECT_SOP.md`](./AI_PROJECT_SOP.md)。

## 資料來源與金鑰設定

複製 `.env.example` 為 `.env.local` 並填入你申請到的金鑰，該項資料來源就會自動改用
真實資料，不需要改程式碼。

| 類別 | 來源 | 是否需要金鑰 | 申請位置 |
|---|---|---|---|
| 地震 | 中央氣象署 開放資料平台（E-A0015-001 顯著有感地震） | 需要（免費） | https://opendata.cwa.gov.tw/ |
| 天氣警特報 | 中央氣象署 開放資料平台（W-C0033-001） | 需要（免費，同上金鑰） | https://opendata.cwa.gov.tw/ |
| 空氣品質 | 環境部（原環保署）即時測站 | 需要（免費） | https://data.moenv.gov.tw/ |
| 交通事件 | TDX 運輸資料流通服務（國道事件） | 需要（免費 Client ID/Secret） | https://tdx.transportdata.tw/ |
| 水利淹水 | 水利署即時水位 join 測站警戒門檻資料 | 不需金鑰，**端點與欄位已確認** | 見下方說明 |
| 水庫蓄水率（併入水利淹水類別） | 水利署 水庫即時水情，蓄水率過低才會顯示 | 預設免金鑰，但需確認實際端點 | 見下方說明 |
| 火災消防 | 新聞 RSS 關鍵字過濾 | 需要至少一組 RSS 來源 | 任一新聞/警廣 RSS |
| 治安快訊 | 新聞 RSS 關鍵字過濾 | 需要至少一組 RSS 來源 | 同上 |
| 停班停課 | 國家災害防救科技中心 (NCDR) 天然災害停止上班上課 RSS 公告 | 不需金鑰，**預設直接啟用** | https://alerts.ncdr.nat.gov.tw/ |
| 疫情監測（與空氣品質共用色相，方形標記） | 疾病管制署 COVID-19 急診/健保就診人次監測（依縣市、跟上週比漲跌） | 不需金鑰，**預設直接啟用** | https://od.cdc.gov.tw/eic/RODS_COVID-19.json |
| 電力供需燈號（獨立橫幅，非分類事件） | 台灣電力公司 電力供需即時資料 | 預設免金鑰，但需確認實際端點 | 見下方說明 |

### 為什麼「治安」類別是新聞快訊，不是官方即時個案資料？

台灣沒有公開即時的個案犯罪資料（隱私法規不允許即時公開個案）。這個類別改用新聞
RSS 搭配關鍵字過濾（如「槍擊」「命案」「縱火」等），並在畫面上明確標示「新聞快訊，
非官方個案資料」，避免誤導成官方統計。若要更嚴謹，可將 `NEWS_RSS_FEEDS` 指向警廣
或警政署新聞稿 RSS。

### 為什麼有些類別的事件感覺很少？

這是刻意設計，不是 bug——空氣品質只顯示 AQI ≥ 100 的測站、水利只顯示超過警戒
水位或蓄水率過低的站點、停班停課只顯示真的停班的縣市，平常狀況正常時這些類別
本來就該接近空白，用意是避免「全部測站都列出來」造成警報疲勞。

真正會限制資料量的兩個地方：

1. **`NEWS_RSS_FEEDS` 預設只有一組 RSS**（中央社），火災/治安新聞的關鍵字過濾
   建立在這組 feed 之上，來源天生就窄。可自行加多組 RSS（逗號分隔）拓寬涵蓋面。
2. **交通事件目前只涵蓋國道**（TDX `Road/Traffic/Incident/Highway`），市區道路、
   省道、大眾運輸事故都沒有涵蓋，需要額外串接 TDX 其他端點才能補上（見
   SPEC.md P2-5）。

### 水利署、停班停課、電力燈號端點請自行核對

`WRA_WATER_LEVEL_URL`（水利淹水）、`WRA_RESERVOIR_URL`（水庫蓄水率）、
`TAIPOWER_GRID_STATUS_URL`（電力供需燈號）的實際回傳欄位，會隨資料集版本
調整。程式已用容錯解析（大小寫不敏感欄位比對、解析失敗自動退回示範資料，
不會讓整個網站崩潰），但建議串接前先用瀏覽器或 curl 打一次實際端點，確認
欄位名稱與 `lib/sources/flood.ts`、`lib/sources/reservoir.ts`、
`lib/gridStatus.ts` 內的假設一致，必要時調整。這個 repo 的開發環境對外網路
被擋，這幾個端點都**未經真實驗證**，見 SPEC.md P0-1。

**水利署端點網域改過一次**：`WRA_WATER_LEVEL_URL`／`WRA_RESERVOIR_URL` 原本
猜測都在 `fhy.wra.gov.tw` 這個網域下，使用者部署後陸續回報 503、以及路徑
微調後的 `fetch failed`（連線層級失敗）。查證後發現 `fhy.wra.gov.tw` 其實是
水利署「防災資訊服務網」給人看的網站後端，不是設計給第三方程式介接的公開
API；真正的開放資料入口是 `opendata.wra.gov.tw`，而且 API 結構也不同——
不是一個固定路徑回傳全台陣列，是**每個資料集各自對應一組資源 ID**，網址
格式是 `opendata.wra.gov.tw/api/v2/{resource-id}?format=JSON`（CKAN 風格）。
**使用者直接在瀏覽器上找到正確的資源 ID 貼給我**：即時水位是
`73c4c3de-4045-4765-abeb-89f9f9cd5ff0`、水庫水情是
`2be9044c-6e44-4856-aad5-dd108c2e6679`，`.env.example` 已更新成這兩個確認
過的網址。另外也順便讓 `fetchJson`/`fetchText`（`lib/sources/util.ts`）對
502/503/504 這類閘道層暫時性錯誤自動重試（最多 2 次），如果之後又遇到
偶發性的 503，應該會自己恢復，不用等下次輪詢。

**河川水位的欄位已用真實回應確認，警戒邏輯也重新設計過**：使用者貼回
`/api/debug?source=flood` 的實際內容後發現，即時水位資料集其實只有
`stationid`／`waterlevel`／`datetime`——完全沒有警戒等級、站名、座標，
原本猜的 `AlertLevel` 欄位根本不存在。要判斷警戒，需要另外 join 一個
「測站基本資料」參考資料集（使用者在 `opendata.wra.gov.tw` 上找到並確認：
`c4acc691-7416-40ca-9464-292c0c00da92`），用即時資料的 `stationid` 對應
參考資料的 `basinidentifier`（同一個值、兩個資料集用了不同欄位名），
從裡面取得：
- 三級警戒門檻 `alertlevel1`/`2`/`3`（一級最高，真實資料
  `alertlevel1: "5.8" > alertlevel2: "4.6"` 驗證了這個順序）
- 真正的站名 `observatoryname`
- **TWD97 TM2 投影座標** `locationbytwd97_xy`（例如
  `"313411.44 2790930.63"`，不是經緯度）

新增 `lib/geo.ts` 的 `twd97ToWgs84()` 做座標轉換，用使用者提供的真實測站
（新磺溪橋，新北市金山區）反查驗證：轉換結果 25.2257°N / 121.6294°E 確實
落在金山區沿海一帶。`lib/sources/flood.ts` 已改寫成平行抓取兩個資料集、
join、依門檻算出嚴重程度（`severityFromLevels()`，已有測試涵蓋門檻邊界與
缺失情況）。因為現在有精確座標，`county` 欄位不再填寫（測站地址只有英文
版，沒有結構化中文縣市欄位，精確座標本身已經足夠定位）。

**水庫蓄水率還沒解決**：使用者也貼了水庫端點的真實回應
（`reservoiridentifier`／`effectivewaterstoragecapacity`／`waterlevel`），
一樣沒有百分比欄位，需要另一個「水庫容量上限」參考資料集才能算蓄水率，
這個資料集的資源 ID 還沒找到，`lib/sources/reservoir.ts` 暫時維持原本的
欄位猜測不變。

**停班停課的資料來源整個換了**：原本猜測的
`www.dgpa.gov.tw/typh/opendata/open.json` 使用者部署後回報 `HTTP 404`，
查證後發現這個路徑可能從來沒存在過——網路上唯一真正介接這份資料的公開專案
是直接抓人事行政總處網頁的 HTML 表格解析，不是打 JSON API，代表這個機關
本身可能沒有提供穩定的 JSON feed。使用者改為提供**國家災害防救科技中心
(NCDR)** 的官方 RSS/Atom 公告 feed，已把 `lib/sources/suspension.ts` 從
`fetchJson` 整個改成重用既有的 RSS 解析器（`lib/sources/newsRss.ts`，本來
是給火災/治安新聞來源用的），並比照那兩個來源用縣市文字比對取得地點座標。
跟 CDC 疫情監測一樣，這個來源**預設直接啟用**（不用先手動找網址填入），
`NCDR_SUSPENSION_URL` 只作為手動覆蓋選項。網域與端點由使用者直接確認過，
但 RSS 項目實際文字內容的欄位/格式仍未驗證（這個網域對開發環境與網頁抓取
工具都是 403），如果部署後這個來源持續是 0 筆，麻煩貼一次
`/api/debug?source=suspension` 的實際回應。

**`lib/sources/epidemic.ts` 的資料來源整個換過一次網域**：原本用
`https://data.cdc.gov.tw/`（CKAN `package_search`／`datastore_search`）
確認 API 本身是標準、文件化的，但正式環境從頭到尾連不上——依序試過重試
邏輯修正、逾時從 10 秒拉長到 25 秒、`maxDuration=60`、加瀏覽器 User-Agent
四種修法，每次使用者重新部署驗證都仍是 `fetch failed`，判斷是這個網域本身
在網路層被擋，不是程式邏輯能修的問題。使用者接著自己在瀏覽器找到
`https://od.cdc.gov.tw/eic/RODS_COVID-19.json`（急診 COVID-19 就診人次）與
`https://od.cdc.gov.tw/eic/NHI_COVID-19.json`（健保門診/住院 COVID-19
就診人次）——**不同網域**、**純靜態 JSON 檔案**（不是 CKAN，不需要搜尋
再抓取，也不需要金鑰），實測後這次真的連得到。現在的 `epidemic.ts`
平行抓這兩個檔案、自動找出資料裡最新的「年+週」，依縣市加總急診人次
（跨年齡層）與健保門診/住院人次，並算出跟上一週相比的漲跌趨勢；嚴重程度
門檻（急診就診人次 ≥80/30/10）是照真實資料校準的實務近似值，不是官方
警戒標準。**代價**：原本監控登革熱／流感／腸病毒的部分被拿掉了，因為那些
欄位名稱本來就從未在真實資料上驗證過——現在換成專注 COVID-19、且欄位已
用真實資料確認過的來源，見 SPEC.md P1-2 的更新說明。

TDX 國道事件的**端點網址與回應欄位**都已由使用者實測確認（透過 `/api/debug`
取得真實回應）：端點是 `/v1/Traffic/RoadEvent/LiveEvent/Freeway`，座標欄位是
`Positions`（WKT 字串 `POINT(lng lat)`，不是分開的 lat/lng 欄位），路名在
`Location.FreeExpressHighway.Road`，嚴重程度文字在 `Impact.Description`，時間
用 `PublishTime`/`EffectiveTime`，唯一 ID 是 `EventID`（`lib/sources/traffic.ts`）。
舊的欄位名稱猜測仍保留作為 fallback，以防其他 TDX RoadEvent 子類型欄位不同。

### 為什麼「電力供需」不是分類事件，而是獨立橫幅？

供電燈號（供電充裕／吃緊／限電警戒／限電準備）是**全國單一指標**，不像地震、
停班停課那樣有明確地點座標，硬塞進地圖分類反而不準確，而且色彩配置已經用滿
8 個固定色相（見下方架構說明的色彩規則），沒有多的色相可以分給第 9 個類別。
因此改用 `components/GridStatusBanner.tsx`，直接沿用嚴重程度的狀態色（灰／黃／
橘／紅），語意上更貼切：它本來就是一個「狀態」，不是一個「事件類別」。

### 為什麼「疫情監測」跟「空氣品質」共用顏色，用方形標記區分？

疫情監測是有地點座標的一般事件（不像電力燈號是全國單一指標），所以走一般的
分類事件流程，但 8 個固定色相在新增這個類別之前就已經用滿（見上方架構說明的
色彩規則：**新色相不能用循環或隨便生成，用滿了就不能再加**）。因此疫情監測
重用「空氣品質」的紫色色相（兩者都屬於公衛/健康領域，語意上還算相關），但在
地圖上改用**方形標記**（`lib/style.ts` 的 `CATEGORY_SHAPE`），列表和圖例的
色點也會跟著變方形，靠「顏色+形狀+文字標籤」三者一起辨識，不會跟空氣品質的
圓形標記混淆。這是 dataviz 設計準則裡「第 9 個類別要用複合編碼，不是生成新
色相」的具體實作方式。

### 事件的時效性怎麼判斷？

每則事件都會顯示**發布時間**（絕對時間＋相對時間，例如「07/15 07:20（15 分鐘
前）」）與**來源**，另外依資料性質分兩種時效標示：

- **有官方效期的類別**（天氣特報、停班停課）：顯示「有效至 HH:mm」，過了效期
  會出現明顯的「⛔ 已過期」紅色警示，快到期（30 分鐘內）會出現「⏳ 即將到期」
  橘色警示。天氣特報的效期直接來自中央氣象署 API 的 `validTime.endTime`；
  停班停課官方 feed 沒有明確結束時間，程式假設效期為**台灣當日 23:59:59**
  （`lib/freshness.ts` 的 `endOfTaiwanDay()`），這是慣例假設，非官方保證。
- **沒有官方效期的類別**（空氣品質、交通、水利淹水、火災、治安）：依類別設定
  「資料較舊」的門檻（例如空氣品質 3 小時、新聞快訊類 12 小時），超過門檻會
  顯示「🕓 資料較舊，建議查核最新狀況」。地震報告視為歷史紀錄，不會標示過期。
- **示範資料**一律有顯眼的 `🧪 示範資料・非即時` 標籤（虛線外框、獨立於其他
  文字），不會被誤認成即時真實資料——這是因為 demo 資料的相對時間
  （「15 分鐘前」）會隨著伺服器重新產生內容而一直重置，光看時間戳記無法判斷
  是不是真的即時資料，所以改成用醒目的標籤直接講明。

## 除錯：查看原始 API 回應（`/api/debug`）

所有資料抓取都在伺服器端執行（SSR），瀏覽器的開發者工具看不到打給 CWA／TDX／
水利署等外部 API 的原始請求與回應。`/api/debug` 就是為了解決這個問題：

```
/api/debug                     → 列出所有可查詢的來源名稱
/api/debug?source=traffic      → 回傳 TDX 國道事件「原始、未經任何欄位轉換」的回應
/api/debug?source=flood        → 水利署河川水位的原始回應
/api/debug?source=epidemic     → CDC 疫情監測（od.cdc.gov.tw 的急診/健保兩份原始 JSON）
/api/debug?source=roadNetwork  → TDX 路網 GIS 原始 GeoJSON（見 SPEC.md P2-6.5，
                                  尚未併入任何分類事件，純粹用來確認欄位格式）
```

可用的 `source` 值：`earthquake`、`weather`、`air`、`traffic`、`flood`、
`reservoir`、`fire`、`security`、`suspension`、`epidemic`、`gridStatus`、
`roadNetwork`。`roadNetwork` 另外支援 `?roadName=`（預設「國道1號」，需自行
URL 編碼中文路名）與 `?top=`（預設 5 筆）覆蓋查詢條件。

畫面右下角「資料來源狀態」清單裡，每個來源都直接附了「查看原始回應」連結
（`components/SourceStatusFooter.tsx`），對應到這裡的 `source` 值，不用自己
組網址。

沒有設定對應金鑰/網址時會回傳 502 錯誤（例如 `TDX_CLIENT_ID / TDX_CLIENT_SECRET
not configured`），這是預期行為，不是 bug。

這是純除錯用途的端點，**刻意不快取**（每次都即時打外部 API，不像 `/api/events`
有 ISR），也沒有加任何驗證/權限保護——回傳的都是政府公開資料本身，沒有夾帶
金鑰內容，風險低，但如果之後想更嚴謹，可以考慮加上簡單的 query 參數密鑰或
直接在正式環境移除這個路由。

## 架構

- **Next.js 16 App Router**。每個分類資料來源各自有一支
  `app/api/events/[category]/route.ts` 端點，電力供需燈號則是獨立的
  `app/api/grid-status/route.ts`——前端各自獨立輪詢，這是「漸進式載入」的
  關鍵（見下方專節）。`app/api/events/route.ts`（不帶分類）仍保留作為
  一次拿到全部資料的聚合端點，伺服器端平行呼叫全部 9 個分類資料來源
  （`Promise.allSettled`，單一來源失敗不影響其他來源）＋ 1 個獨立的電力
  供需燈號，適合需要單次快照的情境（例如手動 curl 檢查全站狀態）。
- `lib/sources/*.ts`：各分類資料來源的 fetcher，統一輸出 `PulseEvent`（見
  `lib/types.ts`）；`lib/gridStatus.ts` 是電力供需燈號的 fetcher，輸出獨立的
  `GridStatus`，不計入分類事件。
- `lib/sourceRegistry.ts`：`CATEGORY_SOURCES`（分類 → fetcher 陣列的對照表，
  例如 `flood` 分類同時對應 `fetchFlood` 與 `fetchReservoirLevels`）與
  `fetchCategory()`，是「一個分類由哪些 fetcher 組成」的唯一定義來源，
  `lib/aggregate.ts` 與 `/api/events/[category]` 都重用這份定義，避免兩處
  各自列一次、之後改分類時漏改其中一處。
- `lib/aggregate.ts`：呼叫 `fetchCategory()` 合併全部分類、排序、附上每個
  來源的狀態（成功/失敗/是否為示範資料），供聚合端點使用。
- 前端 `components/Dashboard.tsx` 對每個分類各自開一個 `useSWR`（放在獨立的
  `CategorySource` 子元件裡，每個分類一個元件實例，不是在迴圈裡直接呼叫
  hook），加上電力燈號自己的 `useSWR("/api/grid-status")`，每
  `NEXT_PUBLIC_REFRESH_MS`（預設 1 分鐘）各自輪詢一次；地圖
  （react-leaflet + OpenStreetMap）與列表共用同一份合併後的篩選狀態；
  `GridStatusBanner` 顯示供需燈號。
- 色彩配置：8 個分類事件各自固定一個色相（不循環使用，已用滿 8 色分類色盤，
  第 9 個類別疫情監測用複合編碼共用色相），嚴重程度另用四階固定的狀態色
  （灰／黃／橘／紅）並搭配圖示與文字，不單靠顏色傳達資訊；電力供需燈號直接
  沿用狀態色，不佔用分類色相。

### 交通事件的路段近似線段

交通事件在地圖上除了原本的點狀標記，還會多畫一小段彩色線（顏色比照嚴重
程度狀態色），代表「這附近有一段路」的視覺效果。**這不是真實的道路線型**——
TDX 的國道事件 API 本身只給一個經緯度點跟 `Direction`（北向/南向/東向/西向）
文字，沒有貼合道路彎道的線段資料；真正的道路線型需要另一組 TDX GIS API
（`Map/Road/Network/RoadClass/{class}/RoadName/{路名}`，回傳 GeoJSON），
但要把事件的 `StartKM`/`EndKM` 對應到那組資料裡實際的線段座標，需要再研究
一輪欄位對應方式，評估後決定先不做（見 SPEC.md P2-6.5）。目前的做法
（`lib/sources/traffic.ts` 的 `approximateRouteSegment()`）只是依 `Direction`
文字判斷大致是南北向還是東西向，以事件座標為中心畫一小段固定長度
（約 300–350 公尺一側）的直線，只有在有精確經緯度（不是縣市中心點 fallback）
時才會畫，避免對著一個不準確的縣市中心點畫出誤導性的路段。

### 漸進式載入資料來源

早期版本前端只打一支聚合端點 `/api/events`，後端等全部 9 個分類（含 10 個
fetcher）＋電力燈號都抓完才回傳一整包 JSON——畫面必須等最慢的來源（交通
事件，要先取得 TDX OAuth token 再打實際 API，屬於兩段式請求）才能整批
渲染，地震、天氣特報這類本來很快的來源也被無謂拖慢。

改成前端對每個分類各自呼叫 `/api/events/[category]`（見上方架構說明），
快的來源先渲染，不用等最慢的那個。之所以不用 SSE/streaming 單一連線改善
體感，是因為 Next.js 的 streaming route handler 必須宣告
`export const dynamic = "force-dynamic"`，會讓每個使用者連線各自觸發真實
fetch，等於繞過現有 ISR 共用快取（下面「自動更新機制」一節），流量一大就
可能超過政府免費 API 的流量限制——這正是先前修過的架構級 bug（`cache:
"no-store"` 悄悄讓整個 route 變成非快取）想避免的情況。拆成多支各自
`revalidate = 120` 的 route，並用 `generateStaticParams()` 預先產生全部
9 個分類的靜態路徑，讓 `/api/events/[category]` 跟 `/api/events` 一樣是
`● SSG, Revalidate 2m`，共用快取效益完全不受影響。

### 自動更新機制

`/api/events` 使用 Next.js Route Handler 的 **ISR（`export const revalidate = 120`）**：

- 前 120 秒內的請求都直接回傳快取的 JSON，不會再打任何政府開放資料 API。
- 超過 120 秒後，下一個進來的請求會觸發**背景重新整理**（stale-while-revalidate）：
  那次請求仍先拿到舊的（略過期的）資料，同時伺服器在背後重新呼叫全部來源，
  之後的請求就會拿到新資料。
- 這樣不管有多少使用者、多常輪詢，實際打到 CWA/TDX/MOENV 等外部 API 的頻率都
  固定為「每 120 秒最多一次」，不會被同時上線的使用者數量放大，也比較不會超過
  這些免費 API 的流量限制。
- 前端 `NEXT_PUBLIC_REFRESH_MS`（預設 60 秒）只是決定瀏覽器多常「問」伺服器一次，
  因為伺服器端已經有快取，調快這個數字幾乎不會增加外部 API 的負擔。
- 想調整快取秒數，直接改 `app/api/events/route.ts` 裡的 `revalidate` 數值，
  以及 `lib/sources/util.ts` 的 `REVALIDATE_SECONDS`（兩者必須一致，見下方
  「已修正的坑」）。

**已修正的坑：`cache: "no-store"` 會讓整個 route 悄悄變成非快取**

`lib/sources/util.ts` 的 `fetchJson`/`fetchText` 原本用 `cache: "no-store"`
呼叫外部 API，理由是「每次都要拿到最新資料，不要被 fetch 層自己的快取擋住」。
但這剛好誤解了 Next.js 的行為：**只要 route 裡有任何一個 `no-store` 的 fetch
真的被執行到，Next.js 就會把整個 route 判定為完全動態渲染，直接蓋掉
`export const revalidate` 設定**——不是「這個 fetch 不快取」，而是「這個
route 不快取」。

實測驗證方式：在只有「找不到金鑰就直接回傳示範資料、完全不呼叫 fetch」的情況
下（例如本機建置時沒有 `.env.local`），`next build` 顯示 `/api/events` 是
`○ Static, Revalidate 2m`；但只要任何一個來源改成「不管有沒有設定都直接呼叫
fetch」，同一次建置就會變成 `ƒ Dynamic`。也就是說，**這個 bug 會在正式環境
（金鑰都設定好、來源真的會呼叫 fetch 時）自動出現**，跟本機示範模式下看起來
正常完全無關。

修法：把 `cache: "no-store"` 全部換成 `next: { revalidate: REVALIDATE_SECONDS }`，
讓 Next.js 自己的 Data Cache 接手個別 API 呼叫的快取與重新驗證，這樣 route
才能真的維持 ISR 靜態渲染。改完後即使來源一直呼叫 fetch，`next build` 仍然
顯示 `○ Static, Revalidate 2m`（已用暫時修改單一來源強制呼叫 fetch 的方式
實測驗證過前後差異）。

## CI/CD

- **CI**（`.github/workflows/ci.yml`）：每次 push 或開 PR 都會自動跑
  `npm ci` → `eslint` → `tsc --noEmit` → `vitest run` → `next build`，任何
  一步失敗 PR 就會顯示紅叉。不需要任何 secrets。單元測試（`lib/**/*.test.ts`）
  只測 `lib/` 底下的純函式（各來源的嚴重程度判斷、時效性計算、縣市座標查詢
  等），見 `AGENTS.md` 2.1-2.2。
- **CD（部署到 Vercel）**：採用 Vercel 原生 Git 整合，一次性設定、之後全自動：
  1. 到 https://vercel.com/new ，選擇 **Import Git Repository**，連接
     `papap35/taiwan-pulse`。
  2. Framework Preset 會自動偵測為 **Next.js**，不需要額外設定 Build/Output 指令。
  3. 在 Vercel 專案的 **Settings → Environment Variables**，依需要貼上
     `.env.example` 裡的變數（`CWA_API_KEY`、`MOENV_API_KEY`、`TDX_CLIENT_ID`、
     `TDX_CLIENT_SECRET`、`WRA_WATER_LEVEL_URL`、`NEWS_RSS_FEEDS` 等）。沒有填的
     一樣會自動退回示範資料，不會部署失敗。
  4. 按 **Deploy**。之後每次 `git push`：
     - push 到其他分支或開 PR → Vercel 自動建立該次的 **Preview 部署**（獨立網址）。
     - push/merge 到 `main` → 自動部署到 **Production**。
  5. Vercel 的部署本身就會執行 `next build`，等同於再做一次建置驗證；GitHub Actions
     CI 則是在這之前先擋掉會壞掉的程式碼，兩者互補、不衝突。

  `/api/events` 的快取／自動更新機制見上方「自動更新機制」一節，Vercel 會自動
  尊重 Next.js 的 `revalidate` 設定，不需要額外設定。

## 已知限制

- 天氣特報、空氣品質、治安/火災新聞、停班停課的地圖座標多為「縣市中心點」而非
  精確地點（因為原始資料本身就是縣市層級）。
- `next build`（含 CI）在建置階段會實際執行一次 `/api/events` 來產生初始快取內容；
  如果建置環境本身沒有對外網路（例如某些 CI 沙盒），全部來源會如預期退回示範
  資料，建置仍會成功，正式環境上線後才會在第一次請求時抓到真實資料。
- `next`（目前使用 16.2.10，最新穩定版）內建的 postcss 依賴仍有一個中等風險的
  build-time CSS 字串化已知漏洞，尚無上游修補版本可用，待 Next.js 釋出修補後應
  盡快升級。
