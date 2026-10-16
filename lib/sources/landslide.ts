import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, pick, safeIso } from "./util";

const NAME = "農業部農村發展及水土保持署 - 土石流警戒";

// Confirmed to exist via the agency's published open-data listing and
// public-facing docs (not yet against a real response — see SPEC.md P1-4):
// this is the "live" debris-flow alert feed, documented to return
// {"errorMessage":"目前無警戒"} when nothing is currently under warning, and
// a list of county/township/village/time records when something is. A
// function (not a module-level const) so vi.stubEnv() can override it in
// tests — this codebase already got burned once by reading process.env at
// import time (see flood.ts's stationInfoUrl()).
function alertUrl(): string {
  return (
    process.env.LANDSLIDE_ALERT_URL ?? "https://246.ardswc.gov.tw/webService/GetAlertData.ashx"
  );
}

// Merged into the "flood" category rather than "weather": both are driven by
// the same rainfall events and already share the water/hydrological-hazard
// umbrella (flood.ts's river levels + reservoir.ts's storage), so this is a
// third fetcher under the same category rather than a new hue — no color
// slot is spent (see AGENTS.md 1.4).
const CATEGORY = "flood" as const;

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-landslide-1",
      category: CATEGORY,
      title: "南投縣信義鄉 土石流紅色警戒（示範資料）",
      description: "請依當地公所指示避難",
      severity: "critical",
      county: "南投縣",
      location: countyCentroid("南投縣"),
      time: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

// Public docs mention a 紅/黃 (red/yellow) two-tier warning, matching the
// existing "土石流紅色" -> critical convention in weatherAlert.ts's
// phenomenaToSeverity(). The real field carrying this tier (if any) is
// unconfirmed, so this defaults every active warning to "serious" (a
// debris-flow warning is significant even without a confirmed red/yellow
// split) and only upgrades to "critical" when red is explicitly present in
// whatever text is available.
export function severityFromAlertText(text: string): Severity {
  if (/紅/.test(text)) return "critical";
  return "serious";
}

function isNoAlertResponse(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    !Array.isArray(raw) &&
    "errorMessage" in (raw as Record<string, unknown>)
  );
}

// Untransformed upstream response, for /api/debug — this is the one field
// mapping in the whole project shipped without a real response to confirm
// it against (see SPEC.md P1-4), so this is the fastest way to validate or
// correct it once deployed.
export async function fetchLandslideRaw(): Promise<unknown> {
  return fetchJson<unknown>(alertUrl());
}

export async function fetchLandslide() {
  try {
    const raw = await fetchJson<unknown>(alertUrl());
    if (isNoAlertResponse(raw)) {
      return ok(CATEGORY, NAME, [], false); // "目前無警戒" — zero active warnings, not a failure
    }
    const records = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
    const events: PulseEvent[] = [];
    for (const r of records) {
      const county = String(pick(r, "County", "county", "縣市") ?? "");
      if (!county) continue; // no usable location, skip rather than guess
      const town = String(pick(r, "Town", "Township", "town", "township", "鄉鎮", "鄉鎮市區") ?? "");
      const village = String(pick(r, "Village", "village", "村里") ?? "");
      const levelText = String(
        pick(r, "AlertLevel", "Level", "level", "Color", "color", "警戒等級", "顏色") ?? ""
      );
      const time = pick(r, "PublishTime", "AlertTime", "time", "發布時間", "發布時刻") as
        | string
        | undefined;
      events.push({
        id: `landslide-${county}-${town}-${village}-${time ?? Date.now()}`,
        category: CATEGORY,
        title: `${county}${town}${village} 土石流警戒`,
        description: levelText || undefined,
        severity: severityFromAlertText(levelText),
        county,
        location: countyCentroid(county),
        time: safeIso(time),
        source: NAME,
      });
    }
    return ok(CATEGORY, NAME, events, false);
  } catch (err) {
    return fail(CATEGORY, NAME, err, demoData());
  }
}
