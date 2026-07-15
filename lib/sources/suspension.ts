import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { endOfTaiwanDay } from "@/lib/freshness";
import { fetchJson, ok, fail, pick } from "./util";

const NAME = "人事行政總處 - 天然災害停止上班上課";

// Status codes used by DGPA's feed: 0 normal, 1 停止上班停止上課,
// 2 停止上班上課(部分), 3 上班上課(視情況調整) — codes vary by release, so we
// treat anything containing "停止上班" / "停止上課" in the text as newsworthy
// regardless of the numeric code, to stay resilient to schema drift.
function severityFromText(text: string): Severity {
  if (/停止上班.*停止上課|停班停課/.test(text)) return "serious";
  if (/停止上班|停止上課/.test(text)) return "warning";
  return "info";
}

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-suspension-1",
      category: "suspension",
      title: "花蓮縣 停止上班及上課（示範資料）",
      description: "颱風來襲，慎防強風豪雨",
      severity: "serious",
      county: "花蓮縣",
      location: countyCentroid("花蓮縣"),
      time: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      validUntil: endOfTaiwanDay(),
      source: NAME,
      isDemo: true,
    },
    {
      id: "demo-suspension-2",
      category: "suspension",
      title: "臺東縣 停止上班及上課（部分地區，示範資料）",
      severity: "warning",
      county: "臺東縣",
      location: countyCentroid("臺東縣"),
      time: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      validUntil: endOfTaiwanDay(),
      source: NAME,
      isDemo: true,
    },
  ];
}

interface SuspensionRecord {
  [key: string]: unknown;
}

interface SuspensionResponse {
  data?: SuspensionRecord[];
}

// Untransformed upstream response, for /api/debug.
export async function fetchSuspensionRaw(): Promise<unknown> {
  const url = process.env.DGPA_SUSPENSION_URL;
  if (!url) throw new Error("DGPA_SUSPENSION_URL not configured");
  return fetchJson<unknown>(url);
}

export async function fetchSuspension() {
  const url = process.env.DGPA_SUSPENSION_URL;
  if (!url) {
    return ok("suspension", NAME, demoData(), true);
  }
  try {
    const raw = await fetchJson<SuspensionResponse | SuspensionRecord[]>(url);
    const records: SuspensionRecord[] = Array.isArray(raw) ? raw : raw.data ?? [];
    const events: PulseEvent[] = [];
    for (const r of records) {
      const county = String(pick(r, "county", "cityname", "COUNTY") ?? "");
      const statusText = String(
        pick(r, "statusname", "status_name", "content", "description") ?? ""
      );
      if (!statusText || /^(上班|上課|正常)/.test(statusText)) continue; // skip "normal" entries
      const town = pick(r, "town", "townname") as string | undefined;
      events.push({
        id: `suspension-${county}-${town ?? ""}-${statusText}`,
        category: "suspension",
        title: `${county}${town ? town : ""} ${statusText}`,
        severity: severityFromText(statusText),
        county,
        location: countyCentroid(county),
        time: new Date().toISOString(),
        // DGPA 公告慣例上以「當日」為單位，官方 feed 本身未提供明確的結束時間，
        // 這裡假設有效期到台灣當日 23:59:59，隔天公告會被新的一筆取代。
        validUntil: endOfTaiwanDay(),
        source: NAME,
      });
    }
    return ok("suspension", NAME, events, false);
  } catch (err) {
    return fail("suspension", NAME, err, demoData());
  }
}
