import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, pick, safeIso } from "./util";

const NAME = "疾病管制署 - 法定傳染病監測";

// Diseases the public most commonly cares about, with a rough "newsworthy"
// weekly case-count threshold. This is a practical approximation, not an
// official CDC alert threshold — endpoint/field names are unverified (see
// SPEC.md P0-1), and disease-specific alert levels vary by outbreak context
// in ways a fixed threshold can't fully capture.
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

export async function fetchEpidemic() {
  const url = process.env.CDC_EPIDEMIC_URL;
  if (!url) {
    return ok("epidemic", NAME, demoData(), true);
  }
  try {
    const raw = await fetchJson<unknown>(url);
    const records: Record<string, unknown>[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : Array.isArray((raw as { records?: unknown[] })?.records)
      ? (raw as { records: Record<string, unknown>[] }).records
      : [];

    const events: PulseEvent[] = [];
    for (const r of records) {
      const diseaseName = String(pick(r, "DiseaseName", "disease", "疾病名稱") ?? "");
      const monitor = MONITORED.find((m) => diseaseName.includes(m.keyword));
      if (!monitor) continue; // only surface diseases we explicitly track

      const countRaw = pick(r, "Cases", "case_count", "病例數", "Count");
      const count = typeof countRaw === "string" ? parseInt(countRaw, 10) : Number(countRaw);
      if (!Number.isFinite(count) || count < monitor.threshold) continue;

      const county = String(pick(r, "County", "county", "縣市") ?? "");
      const time = pick(r, "PublishDate", "publish_date", "week", "WeekEndDate") as
        | string
        | undefined;
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
    return ok("epidemic", NAME, events, false);
  } catch (err) {
    return fail("epidemic", NAME, err, demoData());
  }
}
