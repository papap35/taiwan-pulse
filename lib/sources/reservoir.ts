import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, pick, safeIso, unwrapRecords } from "./util";

// Folded into the existing "flood" category (水利大類) rather than a new
// category — reservoir storage and river water level are both 水利署 data
// and the 8 categorical color slots are already fully used (see SPEC.md).
const NAME = "水利署 - 水庫即時水情";

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-reservoir-1",
      category: "flood",
      title: "曾文水庫 蓄水率 18%（示範資料）",
      description: "低於二級運用標準，請節約用水",
      severity: "serious",
      county: "臺南市",
      location: countyCentroid("臺南市"),
      time: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

// Approximate drought-stage thresholds — Taiwan's official 抗旱評估 stages
// vary by reservoir and are set case-by-case by WRA, this is a reasonable
// general-purpose approximation, not an official classification.
export function severityFromStoragePct(pct: number): Severity {
  if (pct < 10) return "critical";
  if (pct < 20) return "serious";
  return "warning"; // 20–30%
}

// Untransformed upstream response, for /api/debug.
export async function fetchReservoirRaw(): Promise<unknown> {
  const url = process.env.WRA_RESERVOIR_URL;
  if (!url) throw new Error("WRA_RESERVOIR_URL not configured");
  return fetchJson<unknown>(url);
}

export async function fetchReservoirLevels() {
  const url = process.env.WRA_RESERVOIR_URL;
  if (!url) {
    return ok("flood", NAME, demoData(), true);
  }
  try {
    const raw = await fetchJson<unknown>(url);
    // Confirmed real response (2026-07-19): records look like
    // { reservoiridentifier, effectivewaterstoragecapacity, waterlevel,
    // observationtime, ... } — no percentage-of-storage field at all. Storage
    // percentage requires each reservoir's total effective capacity (a
    // separate WRA reference dataset, not yet located — see SPEC.md P0-1),
    // so the pct-based filtering below still can't fire against real data
    // yet; kept as-is (rather than guessed further) until that companion
    // dataset is found, same situation flood.ts was in before its station-info
    // join was found.
    const events: PulseEvent[] = [];
    for (const r of unwrapRecords(raw)) {
      const pctRaw = pick(r, "PercentageOfStorage", "percentage", "storage_rate", "蓄水率");
      const pct = typeof pctRaw === "string" ? parseFloat(pctRaw) : Number(pctRaw);
      if (!Number.isFinite(pct) || pct >= 30) continue; // only surface notably low storage
      const reservoirName = String(
        pick(r, "ReservoirName", "reservoirname", "res_name") ?? "水庫"
      );
      const county = String(pick(r, "County", "county") ?? "");
      const time = pick(r, "RecordTime", "recordtime", "ObsTime") as string | undefined;
      const lat = Number(pick(r, "Latitude", "latitude"));
      const lng = Number(pick(r, "Longitude", "longitude"));
      events.push({
        id: `reservoir-${reservoirName}-${time ?? Date.now()}`,
        category: "flood",
        title: `${reservoirName} 蓄水率 ${pct.toFixed(0)}%`,
        description: pct < 20 ? "低於二級運用標準，請節約用水" : "蓄水率偏低，請留意後續水情",
        severity: severityFromStoragePct(pct),
        county,
        location:
          Number.isFinite(lat) && Number.isFinite(lng)
            ? { lat, lng, name: reservoirName }
            : countyCentroid(county),
        time: safeIso(time),
        source: NAME,
      });
    }
    return ok("flood", NAME, events, false);
  } catch (err) {
    return fail("flood", NAME, err, demoData());
  }
}
