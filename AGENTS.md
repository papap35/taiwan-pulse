# AGENTS.md — 開發規範手冊（Taiwan Pulse）

本文件定義所有 AI agent 與人類開發者在此專案中必須遵守的原則。
每次開發新功能、修 bug、更新 SPEC.md 前，請先通讀對應章節。

> **每次 PR 前都必須執行 3.5 Step 2.5 文件同步檢查**，確認 SPEC.md、README.md、
> `.env.example`、AGENTS.md 均已反映本次異動。

---

## 目錄

1. [寫程式的原則](#1-寫程式的原則)
2. [測試與驗證的原則](#2-測試與驗證的原則)
3. [開發流程原則（Branch → Commit → PR）](#3-開發流程原則branch--commit--pr)
4. [Commit 的原則](#4-commit-的原則)
5. [判讀與更新 SPEC.md 的原則](#5-判讀與更新-specmd-的原則)

---

## 1. 寫程式的原則

### 1.1 分層架構（依賴方向固定）

```
允許的依賴方向：
  app/                → components/, lib/           ✅
  components/         → lib/（types, style, time, counties）✅
  components/Dashboard → 其他 components（純組裝，無業務邏輯）✅
  lib/aggregate.ts    → lib/sources/*.ts, lib/gridStatus.ts ✅
  lib/sources/*.ts    → lib/sources/util.ts, lib/counties.ts, lib/types.ts ✅
  lib/sources/*.ts    → 其他 lib/sources/*.ts        ❌（每個來源互相獨立）
  components/X        → components/Y 的業務邏輯       ❌（只能共用 lib/ 底下的東西）
```

- 一個資料來源 = 一個 `lib/sources/<name>.ts`，對外只匯出 `fetchXxx()`，回傳
  `{ events: PulseEvent[], status: SourceStatus }`（用 `ok()` / `fail()` helper 組裝）。
- 新增分類事件來源時比照既有檔案的結構：`demoData()` 產生示範資料 → 有金鑰/URL
  才呼叫真實 API → try/catch 失敗一律 `fail()` 退回示範資料，**絕不讓單一來源的
  例外往上炸掉整個 `/api/events`**。
- 「系統狀態」型資料（像 `lib/gridStatus.ts` 電力供需燈號）與「分類事件」型資料
  （`lib/sources/*.ts`）分開放：前者沒有座標、是單一全國指標，不佔用
  `CATEGORY_ORDER` 的色相名額。

### 1.2 資料正規化與型別

- 所有分類事件必須符合 `lib/types.ts` 的 `PulseEvent`，欄位語意固定：
  `severity` 只能是 `info|warning|serious|critical`，`category` 必須先加進
  `CATEGORY_ORDER`（見 1.4 色彩規則）才能使用。
- 新增欄位時同步更新 `lib/types.ts` 的介面與對應的 `_LABELS` 常數，不要在元件
  裡硬寫中文字串。

### 1.3 防禦性資料處理

- 任何從外部 API 來的欄位，一律透過 `lib/sources/util.ts` 的 `pick()` 做
  大小寫不敏感查找（政府開放資料欄位命名常常不一致或跨版本改變）。
- 數字欄位一律先 `Number(...)` / `parseFloat(...)` 再用 `Number.isFinite()`
  檢查，NaN/undefined 一律視為「這筆資料不可信」，跳過該筆而不是硬塞入畫面。
- 找不到地點座標時，用 `countyCentroid()` 退回縣市中心點，並在 UI 上以縣市
  名稱標示（不要假裝有精確座標）。

### 1.4 色彩與 UI 規則（見 dataviz 設計準則）

- 分類色相固定 8 個、依 `CATEGORY_ORDER` 順序分配，**不循環使用**；已經用滿
  時，新類別不能硬塞一個新色相——改用複合編碼（形狀/圖示）或獨立於分類色盤
  之外的呈現方式（例如電力燈號改用狀態色）。
- 嚴重程度一律用固定的狀態色（灰/黃/橘/紅）＋ icon ＋ 文字三者同時呈現，不
  單靠顏色傳達語意。
- 新增 UI 前參考 `dataviz` skill 的色彩公式與檢查清單。

### 1.5 錯誤處理

- 外部 API 呼叫一律 `try/catch` 包起來，失敗時退回示範資料並在 `SourceStatus`
  標記 `ok:false`、附上 `error` 訊息，畫面上以「資料來源狀態」區塊顯示，不讓
  單一來源掛掉造成整頁白畫面。
- `lib/sources/util.ts` 的 `fetchJson` / `fetchText` 已內建 timeout（預設
  10 秒）與 `AbortController`，新的 fetcher 一律透過這兩個 helper 呼叫外部
  API，不要自己重寫 `fetch`。

---

## 2. 測試與驗證的原則

### 2.1 現況

專案使用 **Vitest** 做單元測試，測試檔案跟被測程式放同一層目錄，命名為
`*.test.ts`（例如 `lib/sources/earthquake.ts` 對應
`lib/sources/earthquake.test.ts`）。只測 `lib/` 底下的純函式，**不做元件
整合測試**（元件邏輯應盡量薄，真正的邏輯留在 `lib/` 讓它可測）。

```bash
npx tsc --noEmit   # 型別檢查
npm run lint       # eslint（flat config, ESLint 9 + Next 16）
npm test           # vitest run，跑一次全部測試（CI 用這個，不是 watch 模式）
npm run build      # 確認可正式建置，且 /api/events 的 revalidate 設定正確
```

以及必要時用 Playwright 手動開瀏覽器截圖驗證（見 `verify` skill），檢查：
- demo 資料在沒有任何金鑰/URL 時，8 個分類 + 電力燈號都正常渲染
- light/dark mode 都正常
- 分類篩選、地圖 marker、清單點選連動正常

### 2.2 測試涵蓋範圍與規則

**現在有測試的純函式**（每個都有對應 `*.test.ts`）：
`lib/counties.ts`（`countyCentroid`）、`lib/freshness.ts`（`computeFreshness`、
`endOfTaiwanDay`）、`lib/sources/util.ts`（`pick`、`safeIso`、
`safeIsoOrUndefined`）、以及每個來源的嚴重程度判斷函式（`magnitudeToSeverity`、
`aqiToSeverity`、`phenomenaToSeverity`、`severityFromDescription`、
`severityFromText`、`severityFromStoragePct`、`levelFromReserveRate`）。

**規則**：
- 這些嚴重程度判斷函式**必須維持 `export`**（不能改回 module-private），
  否則測試檔案無法 import。
- 新增資料來源時，若有類似的「輸入 → 判斷嚴重程度/狀態」的純函式，
  **一律用 `export function` 寫、同一個 PR 內補測試**，不要事後補。
- 測試結構、命名規範、防迴歸測試規則見 4.x 節（Commit 原則）與下方範例。
- `lib/sources/util.test.ts` 裡的 `safeIso` 防迴歸測試對應真實發生過的
  production bug（地震來源日期解析失敗直接 throw，導致整批真實資料被丟棄
  退回示範資料）——這是「防迴歸測試要寫明具體 bug」的實例，之後新增防迴歸
  測試都應該比照這種具體程度。

### 2.3 每次 commit / PR 前必須確認

```
□ npx tsc --noEmit 通過（0 error）
□ npm run lint 通過（0 error，warning 需說明或修掉）
□ npm test 通過（0 failed）
□ npm run build 成功，且 /api/events 的 Revalidate 欄位符合預期
□ 新增/修改的資料來源：至少手動 curl 過一次 /api/events，確認沒有 demoData
  以外的例外（若沒有真實金鑰可測，至少確認 demo fallback 正常）；有欄位對不上
  時優先用 `/api/debug?source=<name>` 直接看原始回應，不要用猜的來回修
□ 新增的純判斷函式（嚴重程度、狀態）有對應的 `*.test.ts`，涵蓋正常/邊界/
  錯誤情況（見 2.2）
```

---

## 3. 開發流程原則（Branch → Commit → PR）

### 3.0 完整開發流程（必須遵守）

```
1. 確認目前在 main，且 main 是最新的
   git checkout main && git pull

2. 從 main 建立新 branch（命名規則見下方）
   git checkout -b <type>/<scope>-<簡述>

3. 在 branch 上開發，分批 commit（每個 commit 一件事）

4. 開發完畢，執行自我 review（見 3.5），文件同步（Step 2.5）必須在同一 branch 補 commit

5. 建立 PR，並等待 review 後 merge

6. 若 PR 開啟後有追加 commit，同步更新 PR title / description
```

**Branch 命名規則：**

| Prefix      | 用途                     | 範例                              |
| ----------- | ------------------------ | ---------------------------------- |
| `feat/`     | 新功能（新資料來源/新 UI）| `feat/suspension-category`         |
| `fix/`      | Bug 修正                  | `fix/flood-severity-mapping`       |
| `refactor/` | 重構（不影響行為）        | `refactor/sources-shared-helper`   |
| `docs/`     | 文件更新                  | `docs/bootstrap-spec-agents`       |
| `chore/`    | 依賴、CI/CD、工具雜務     | `chore/bump-next-16`               |

> ⚠️ **PR 一律開向 `main`**。若發現 `main` 上沒有你預期的最新內容（例如上一個
> PR 已經被合併但本地分支還停在舊狀態），先 `git fetch origin main` 確認，
> 再從 `origin/main` 重新分支，不要對著過期的 base 開 PR（過去發生過「PR head
> 是 base 的祖先」導致 GitHub 拒絕建立 PR 的情況，見下方 3.6）。

### 3.5 PR 建立前的自我 Review 流程

#### Step 1：確認 diff 範圍合理

```bash
git fetch origin main
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

#### Step 2：逐項清單檢查

```
□ 所有改動都是本次需求的範疇，沒有夾帶不相關的修改
□ 沒有 console.log 除錯碼遺留
□ 新的資料來源函式遵循 1.1 的結構（demoData → 真實 API → try/catch fail()）
□ npx tsc --noEmit / npm run lint / npm run build 全部通過
□ SPEC.md 狀態已同步更新
```

#### Step 2.5：文件同步檢查（每次 PR 必做）

> ⛔ **硬性門檻**：`.md` 更新必須 commit 在**同一個 branch**，與功能程式碼
> 一起進 PR，不可以「先開 PR、事後再補文件」。

| 檔案 | 每次功能 PR 應確認的事項 |
|------|------------------------|
| **SPEC.md** | 對應功能項目是否已標記 `[x]`；有新需求是否已補規格 |
| **README.md** | 資料來源表格、架構說明、已知限制是否反映新變更 |
| **.env.example** | 新資料來源需要的環境變數是否已補上，含註解說明申請位置 |
| **AGENTS.md** | 若有新的開發規範、色彩規則、架構決策，是否已補充 |

**判斷要不要更新的原則：**

- 新增分類事件或狀態橫幅 → **README + .env.example 必更新**
- 新增/調整 UI 顯示邏輯 → **README「架構」段落視情況更新**
- 功能完成 → **SPEC.md 必標 `[x]`**
- 只是內部重構或 bug fix（使用者感知不到）→ .md 可不更新，但 commit message 要說明

#### Step 3：針對這次 PR 的風險評估

自問，任一題不確定就要補說明或先跟使用者確認：

1. 這個改動會不會讓某個分類事件在沒有金鑰時變成空白（漏掉 demo fallback）？
2. 新的外部 API 欄位假設有沒有明確標註「未經真實端點驗證」？
3. 是否影響到 `/api/events` 的 revalidate 快取行為？

#### Step 4：撰寫 PR 描述

```markdown
## Summary
- 做了什麼（列點）、為什麼

## Test plan
- [x] npx tsc --noEmit
- [x] npm run lint
- [x] npm run build
- [ ] 手動驗證步驟（demo 資料 / 真實資料）

## 已知風險 / 後續待辦
（沒有就寫「無」）
```

### 3.6 已知坑：main 分支與 PR 建立

這個 repo 一開始沒有 `main` 分支，後續透過「先建立空的 main，再在其上重建內容」
的方式補上，過程中踩過「PR head 是 base 的祖先」導致 GitHub 拒絕建立 PR 的坑
（見 PR #1 的處理過程）。現在 `main` 已經是正常、完整的分支，**之後的開發不需
要再處理這個問題**，只要固定「從最新的 `origin/main` 分支出去」即可。若某次
`main` 上的 PR 已經被合併、而你本地的 designated branch 還停在被合併前的舊
歷史，**重新從 `origin/main` 建立分支再套用你的 commit**（`git checkout -B
<branch> origin/main` + `git cherry-pick <commit>`），不要對著過期分支硬開 PR。

---

## 4. Commit 的原則

### 4.1 Commit 時機

- 一個 commit 只做一件事。
- 不 commit 未完成的半成品（除非用 `WIP:` 前綴明確標示）。

### 4.2 Commit Message 格式（Conventional Commits）

```
<type>(<scope>): <簡短說明>

[選填] 較詳細的說明，說明「為什麼」而非「做了什麼」
```

**type 清單：**

| type       | 用途                                   |
| ---------- | -------------------------------------- |
| `feat`     | 新功能（新分類事件、新 UI）             |
| `fix`      | 修 bug                                 |
| `refactor` | 重構（不影響行為）                      |
| `docs`     | 文件更新（README、SPEC.md、AGENTS.md）  |
| `chore`    | 依賴、CI/CD、建置工具等雜務              |

**scope 範例：** `earthquake`、`traffic`、`suspension`、`grid-status`、`api`、`ui`、`ci`

```bash
# 範例
feat(suspension): 新增停班停課分類事件來源
fix(flood): 水位站座標缺失時退回縣市中心點
docs(spec): 標記停班停課、電力供需燈號為已完成
chore(ci): 新增 GitHub Actions lint/typecheck/build workflow
```

### 4.3 commit 前檢查清單

```
□ npx tsc --noEmit 通過
□ npm run lint 通過
□ npm run build 成功
□ 沒有 console.log 除錯碼遺留
□ 沒有 hardcode 的 API key（一律走 .env / .env.example 佔位）
□ SPEC.md 對應功能狀態已更新
□ README / .env.example 已在本 branch 更新（見 3.5 Step 2.5）
```

### 4.4 不應該 commit 的東西

- `node_modules/`、`.next/`、`*.tsbuildinfo`（已在 .gitignore）
- `.env` / `.env.local` 或任何含真實 API key 的檔案
- 暫時的測試用 `console.log`

---

## 5. 判讀與更新 SPEC.md 的原則

### 5.1 SPEC.md 的用途

`SPEC.md` 是本系統的**功能規格書與路線圖**，決定下一步做什麼、什麼不做。

### 5.2 優先級判讀規則

| 優先級 | 意義                                         | 開發原則                     |
| ------ | -------------------------------------------- | ----------------------------- |
| P0     | 資料正確性 / 安全性相關，缺少會誤導使用者     | **必須最先處理**，不可跳過   |
| P1     | 核心價值：更多災害/民生資料類別               | P0 完成後立即實作            |
| P2     | 進階體驗（通知、更細的交通/民生資料）         | P1 穩定後排入                |
| P3     | 長期使用價值（歷史紀錄、統計）                | 有餘力再做                   |
| P4+    | 差異化 / 需要付費或不穩定外部資源             | 評估可行性後再決定           |

**禁止跳著做**：不可因為某個低優先級功能「比較有趣」就跳過高優先級項目。

### 5.3 標記功能狀態

```
- [ ] 待開發
- [x] 已完成
- [~] 進行中（partial / WIP）
- [-] 已決定不做（附理由）
```

每次功能完成，commit message 加入 `docs(spec): 標記 <項目> 為已完成`。

### 5.4 新增功能到 SPEC.md 的格式

```markdown
#### N. 功能名稱 `[ ]`

**背景**：為什麼需要（使用者痛點 / 資料缺口）
**功能規格**：
- 具體要做什麼（條列）
- 涉及的檔案/模組
**資料來源**：機關名稱 + API 是否需要金鑰 + 是否已驗證過真實端點
**優先級理由**：為什麼是這個優先級
```

### 5.5 判讀「做還是不做」

1. **是否提升資料正確性 / 修正誤導性資訊？** → 是，立即評估，可插隊到 P0
2. **是否解決現有功能的 bug？** → 是，列為 hotfix，立即處理
3. **是否有穩定、免費、有文件的官方開放資料 API？** → 是，優先排入 P1/P2
4. **是否只有非官方/不穩定資料來源（需靠新聞關鍵字過濾）？** → 依既有
   `security`/`fire` 的模式實作，但必須在 UI 上明確標示「新聞快訊，非官方
   個案資料」，不可包裝成官方統計
5. **是否需要付費 API 或複雜基礎設施？** → 記錄在 SPEC.md P4+，先不做

### 5.6 資料來源評估準則

| 優先級 | 來源類型 | 範例 |
| ------ | -------- | ---- |
| 1 | 有免費金鑰、文件完整、穩定多年的官方 API | 中央氣象署地震/天氣特報 |
| 2 | 免金鑰但欄位/端點可能隨版本調整的官方開放資料 | 水利署水位、TDX 交通、停班停課、電力燈號 |
| 3 | 沒有即時個案資料，改用新聞 RSS + 關鍵字過濾 | 治安快訊、火災快訊 |
| 4 | 需要付費或審核較嚴格的 API | 記錄在 SPEC.md，評估成本後再做 |

第 2 類來源**一律**要在程式裡用 `pick()` 做容錯欄位解析、try/catch 退回示範
資料，並在 README 註明「端點請自行核對」。

---

## 附錄：專案技術棧速查

```
框架：Next.js 16（App Router）+ React 19 + TypeScript 5
樣式：Tailwind CSS 3
地圖：react-leaflet 5 + OpenStreetMap（無需金鑰）
資料抓取：SWR（前端輪詢）+ Next.js Route Handler revalidate（伺服器端 ISR 快取）
RSS 解析：fast-xml-parser
Lint：ESLint 9（flat config，eslint-config-next）
測試：Vitest（`lib/**/*.test.ts`，只測純函式，見 2.1、2.2）
除錯：`/api/debug?source=<name>` 查看各來源未經轉換的原始上游回應
CI：GitHub Actions（.github/workflows/ci.yml）— lint → typecheck → test → build
部署：Vercel（原生 Git 整合，自動 Preview / Production）
```

## 附錄：常用指令

```bash
# 開發
npm run dev

# 型別檢查
npx tsc --noEmit

# Lint
npm run lint

# 測試（單次執行，CI / commit 前用這個）
npm test

# 測試（監看模式，開發中用）
npm run test:watch

# 正式建置（同時驗證 revalidate 設定）
npm run build

# 啟動正式版本（需先 build）
npm run start
```
