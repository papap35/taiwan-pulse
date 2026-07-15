import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, pick, safeIso } from "./util";

const NAME = "疾病管制署 - 法定傳染病監測";

// Confirmed via CDC's own published OpenAPI spec (user-provided, 2026-07-15):
// the CDC open data portal is a standard CKAN instance at this base URL.
// CKAN's action API (package_search, datastore_search) is documented,
// stable, open-source software — not a Taiwan-specific guess — so this
// source can default to "on" without requiring the user to hunt down a
// specific dataset URL first, unlike the previous single-URL approach.
const CDC_API_BASE = process.env.CDC_API_BASE ?? "https://data.cdc.gov.tw/api/3";
// CKAN full-text search query used to locate the notifiable-disease
// dataset. Override if this doesn't land on the right package.
const SEARCH_QUERY = process.env.CDC_EPIDEMIC_SEARCH ?? "法定傳染病";

// Diseases the public most commonly cares about, with a rough "newsworthy"
// weekly case-count threshold. This is a practical approximation, not an
// official CDC alert threshold. The dataset's own column names are still a
// guess (see SPEC.md P0-1) — only the CKAN search/fetch mechanism itself is
// confirmed correct.
const MONITORED: { keyword: string; threshold: number; severity: Severity }[] = [
  { keyword: "登革熱", threshold: 1, severity: "serious" }, // 本土病例即具新聞性
  { keyword: "流感", threshold: 50, severity: "warning" },
  { keyword: "腸病毒", threshold: 30, severity: "warning" },
  { keyword: "COVID", threshold: 100, severity: "warning" },
];

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-epidemic-1",
      category: "epidemic",
      title: "高雄市 登革熱本土病例 4 例（示範資料）",
      description: "近一週新增本土病例，請落實住家及周邊孳生源巡檢",
      severity: "serious",
      county: "高雄市",
      location: countyCentroid("高雄市"),
      time: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

interface CkanResource {
  id: string;
  format?: string;
  datastore_active?: boolean;
  url?: string;
}

interface CkanPackage {
  name: string;
  resources?: CkanResource[];
}

interface CkanSearchResponse {
  success?: boolean;
  result?: { count?: number; results?: CkanPackage[] };
}

interface CkanDatastoreResponse {
  success?: boolean;
  result?: { records?: Record<string, unknown>[] };
}

// Two-step CKAN flow: find the dataset by search, then read its data —
// either through CKAN's own queryable datastore (preferred) or by fetching
// the resource's raw file URL (CSV/JSON) directly.
async function fetchViaCkanSearch(): Promise<Record<string, unknown>[]> {
  const searchUrl = `${CDC_API_BASE}/action/package_search?q=${encodeURIComponent(SEARCH_QUERY)}`;
  const search = await fetchJson<CkanSearchResponse>(searchUrl);
  const pkg = search.result?.results?.[0];
  if (!pkg) throw new Error(`no CKAN package found for query "${SEARCH_QUERY}"`);

  const resource = pkg.resources?.find((r) => r.datastore_active) ?? pkg.resources?.[0];
  if (!resource) throw new Error(`CKAN package "${pkg.name}" has no resources`);

  if (resource.datastore_active) {
    const dsUrl = `${CDC_API_BASE}/action/datastore_search?resource_id=${resource.id}&limit=500`;
    const ds = await fetchJson<CkanDatastoreResponse>(dsUrl);
    return ds.result?.records ?? [];
  }

  if (!resource.url) {
    throw new Error(`CKAN resource "${resource.id}" has no url and is not datastore-active`);
  }
  const raw = await fetchJson<unknown>(resource.url);
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

export async function fetchEpidemic() {
  try {
    // CDC_EPIDEMIC_URL stays as a manual override: set it if you've already
    // found the exact dataset resource yourself and want to skip the search
    // step entirely.
    const manualUrl = process.env.CDC_EPIDEMIC_URL;
    let records: Record<string, unknown>[];
    if (manualUrl) {
      const raw = await fetchJson<unknown>(manualUrl);
      records = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
    } else {
      records = await fetchViaCkanSearch();
    }

    const events: PulseEvent[] = [];
    for (const r of records) {
      const diseaseName = String(
        pick(r, "DiseaseName", "disease", "疾病名稱", "確定病名") ?? ""
      );
      const monitor = MONITORED.find((m) => diseaseName.includes(m.keyword));
      if (!monitor) continue; // only surface diseases we explicitly track

      const countRaw = pick(r, "Cases", "case_count", "病例數", "確定病例數", "Count");
      const count = typeof countRaw === "string" ? parseInt(countRaw, 10) : Number(countRaw);
      if (!Number.isFinite(count) || count < monitor.threshold) continue;

      const county = String(pick(r, "County", "county", "縣市", "居住縣市") ?? "");
      const time = pick(
        r,
        "PublishDate",
        "publish_date",
        "week",
        "WeekEndDate",
        "通報日",
        "個案研判日"
      ) as string | undefined;
      events.push({
        id: `epidemic-${diseaseName}-${county}-${time ?? Date.now()}`,
        category: "epidemic",
        title: `${county} ${diseaseName} ${count} 例`,
        severity: monitor.severity,
        county,
        location: countyCentroid(county),
        time: safeIso(time),
        source: NAME,
      });
    }
    if (events.length === 0) return ok("epidemic", NAME, [], false);
    return ok("epidemic", NAME, events, false);
  } catch (err) {
    return fail("epidemic", NAME, err, demoData());
  }
}
