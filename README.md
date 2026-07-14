# Taiwan Pulse 台灣即時監控

[![CI](https://github.com/papap35/taiwan-pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/papap35/taiwan-pulse/actions/workflows/ci.yml)

整合台灣多項官方開放資料的即時監控儀表板：地震、天氣警特報、空氣品質、交通事件、
水利淹水、火災消防、治安快訊，在地圖與列表上即時呈現，並依嚴重程度分級。

## 快速開始

```bash
npm install
npm run dev
```

開啟 http://localhost:3000。**不需要任何 API 金鑰即可執行** — 尚未設定的資料來源會
顯示清楚標記為「示範資料」的範例事件，畫面右下角「資料來源狀態」可看到每個來源是
使用真實資料還是示範資料。

## 資料來源與金鑰設定

複製 `.env.example` 為 `.env.local` 並填入你申請到的金鑰，該項資料來源就會自動改用
真實資料，不需要改程式碼。

| 類別 | 來源 | 是否需要金鑰 | 申請位置 |
|---|---|---|---|
| 地震 | 中央氣象署 開放資料平台（E-A0015-001 顯著有感地震） | 需要（免費） | https://opendata.cwa.gov.tw/ |
| 天氣警特報 | 中央氣象署 開放資料平台（W-C0033-001） | 需要（免費，同上金鑰） | https://opendata.cwa.gov.tw/ |
| 空氣品質 | 環境部（原環保署）即時測站 | 需要（免費） | https://data.moenv.gov.tw/ |
| 交通事件 | TDX 運輸資料流通服務（國道事件） | 需要（免費 Client ID/Secret） | https://tdx.transportdata.tw/ |
| 水利淹水 | 水利署防災資訊服務網 即時水位 | 預設免金鑰，但需確認實際端點 | 見下方說明 |
| 火災消防 | 新聞 RSS 關鍵字過濾 | 需要至少一組 RSS 來源 | 任一新聞/警廣 RSS |
| 治安快訊 | 新聞 RSS 關鍵字過濾 | 需要至少一組 RSS 來源 | 同上 |

### 為什麼「治安」類別是新聞快訊，不是官方即時個案資料？

台灣沒有公開即時的個案犯罪資料（隱私法規不允許即時公開個案）。這個類別改用新聞
RSS 搭配關鍵字過濾（如「槍擊」「命案」「縱火」等），並在畫面上明確標示「新聞快訊，
非官方個案資料」，避免誤導成官方統計。若要更嚴謹，可將 `NEWS_RSS_FEEDS` 指向警廣
或警政署新聞稿 RSS。

### 水利署與 TDX 端點請自行核對

`WRA_WATER_LEVEL_URL`（水利淹水）與 TDX 國道事件 API 的實際回傳欄位，會隨資料集
版本调整。程式已用容錯解析（大小寫不敏感欄位比對、解析失敗自動退回示範資料，不會
讓整個網站崩潰），但建議串接前先用瀏覽器或 curl 打一次實際端點，確認欄位名稱與
`lib/sources/flood.ts`、`lib/sources/traffic.ts` 內的假設一致，必要時調整。

## 架構

- **Next.js 16 App Router**，`app/api/events/route.ts` 是唯一的後端聚合端點，
  伺服器端平行呼叫全部 7 個資料來源（`Promise.allSettled`，單一來源失敗不影響其他來源）。
- `lib/sources/*.ts`：各資料來源的 fetcher，統一輸出 `PulseEvent`（見 `lib/types.ts`）。
- `lib/aggregate.ts`：合併、排序、附上每個來源的狀態（成功/失敗/是否為示範資料）。
- 前端 `components/Dashboard.tsx` 用 SWR 每 `NEXT_PUBLIC_REFRESH_MS`（預設 2 分鐘）
  輪詢一次 `/api/events`，地圖（react-leaflet + OpenStreetMap）與列表共用同一份
  篩選狀態。
- 色彩配置：7 個類別各自固定一個色相（不循環使用），嚴重程度另用四階固定的
  狀態色（灰／黃／橘／紅）並搭配圖示與文字，不單靠顏色傳達資訊。

## CI/CD

- **CI**（`.github/workflows/ci.yml`）：每次 push 或開 PR 都會自動跑
  `npm ci` → `eslint` → `tsc --noEmit` → `next build`，任何一步失敗 PR 就會顯示紅叉。
  不需要任何 secrets。
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

  注意：`/api/events` 標記為 `force-dynamic`（不快取），每次請求都會即時打外部
  API；流量大時可考慮在 `aggregateEvents()` 外加上簡單的記憶體或 Edge Config 快取層。

## 已知限制

- 天氣特報、空氣品質、治安/火災新聞的地圖座標多為「縣市中心點」而非精確地點
  （因為原始資料本身就是縣市層級）。
- `next`（目前使用 16.2.10，最新穩定版）內建的 postcss 依賴仍有一個中等風險的
  build-time CSS 字串化已知漏洞，尚無上游修補版本可用，待 Next.js 釋出修補後應
  盡快升級。
