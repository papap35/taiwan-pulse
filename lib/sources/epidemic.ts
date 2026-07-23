import { PulseEvent, Severity } from "@/lib/types";
import { countyCentroid } from "@/lib/counties";
import { fetchJson, ok, fail, parseNum } from "./util";

const NAME = "疾病管制署 - COVID-19 監測";

// Confirmed by the user (2026-07-23): od.cdc.gov.tw hosts these as plain
// static JSON files — no CKAN search/datastore indirection, no auth. This
// replaces the previous data.cdc.gov.tw CKAN-search approach entirely, which
// never actually connected in production (see SPEC.md P0-1/T3) regardless of
// timeout/retry/User-Agent fixes. Trade-off: this is COVID-19-specific (the
// old MONITORED multi-disease table — 登革熱/流感/腸病毒 — is dropped), but
// that table's field names were themselves unconfirmed guesses that never
// got to run against real data anyway.
const CDC_TIMEOUT_MS = 20000; // each file is a full historical export (MB-sized), not a small API response

// Functions, not module-level constants — a top-level `const X = process.env.Y`
// reads the env var once at import time, which breaks `vi.stubEnv` in tests
// (exactly the bug this codebase already got burned by once, in flood.ts's
// stationInfoUrl()).
function rodsUrl(): string {
  return process.env.CDC_RODS_URL ?? "https://od.cdc.gov.tw/eic/RODS_COVID-19.json";
}
function nhiUrl(): string {
  return process.env.CDC_NHI_URL ?? "https://od.cdc.gov.tw/eic/NHI_COVID-19.json";
}

// Both files are flat arrays of weekly per-county-per-age-group records
// going back to 2021/2022 (confirmed against real data pasted by the user)
// — not a "current status" snapshot — so this source has to find the latest
// week itself and aggregate across age groups (and, for NHI, 就診類別).
interface WeeklyRecord {
  年: string;
  週: string;
  縣市: string;
  [key: string]: string;
}

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-epidemic-1",
      category: "epidemic",
      title: "台北市 COVID-19 急診就診 96 人次（示範資料）",
      description: "較上週 +33%，健保門診 605 人次、住院 13 人次（第 2026 年第 28 週）",
      severity: "critical",
      county: "台北市",
      location: countyCentroid("台北市"),
      time: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

export function latestYearWeek(
  records: WeeklyRecord[]
): { year: number; week: number } | undefined {
  let best: { year: number; week: number } | undefined;
  for (const r of records) {
    const year = parseInt(r["年"], 10);
    const week = parseInt(r["週"], 10);
    if (!Number.isFinite(year) || !Number.isFinite(week)) continue;
    if (!best || year > best.year || (year === best.year && week > best.week)) {
      best = { year, week };
    }
  }
  return best;
}

export function previousYearWeek(year: number, week: number): { year: number; week: number } {
  return week > 1 ? { year, week: week - 1 } : { year: year - 1, week: 52 };
}

// CDC's weekly datasets carry a year+epidemiological-week pair, not an exact
// calendar date. This approximates the week's start purely so events sort
// chronologically and the freshness badge has something to compare against —
// it isn't meant to reproduce CDC's own week-boundary definition exactly.
export function yearWeekToIso(year: number, week: number): string {
  const jan1 = Date.UTC(year, 0, 1);
  return new Date(jan1 + (week - 1) * 7 * 24 * 60 * 60 * 1000).toISOString();
}

// Practical display thresholds, not an official CDC alert level (same
// caveat as the old MONITORED table) — calibrated against real 2026-W28
// data, where the six largest cities all sat between 43 and 96 weekly ER
// visits nationwide.
export function severityFromErVisits(count: number): Severity | undefined {
  if (count >= 80) return "critical";
  if (count >= 30) return "serious";
  if (count >= 10) return "warning";
  return undefined;
}

export function sumByCounty(
  records: WeeklyRecord[],
  year: number,
  week: number,
  valueKey: string,
  filter?: (r: WeeklyRecord) => boolean
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of records) {
    if (parseInt(r["年"], 10) !== year || parseInt(r["週"], 10) !== week) continue;
    if (filter && !filter(r)) continue;
    const county = r["縣市"];
    if (!county) continue;
    const n = parseNum(r[valueKey]) ?? 0;
    totals.set(county, (totals.get(county) ?? 0) + n);
  }
  return totals;
}

// Untransformed upstream responses, for /api/debug. These are the full
// historical exports (MB-sized) rather than a trimmed sample — consistent
// with every other source's raw fetcher showing exactly what the government
// API returns, but worth knowing before hitting this in a browser.
export async function fetchEpidemicRaw(): Promise<unknown> {
  const [rods, nhi] = await Promise.all([
    fetchJson<unknown>(rodsUrl(), undefined, CDC_TIMEOUT_MS),
    fetchJson<unknown>(nhiUrl(), undefined, CDC_TIMEOUT_MS),
  ]);
  return { rods, nhi };
}

export async function fetchEpidemic() {
  try {
    const [rods, nhi] = await Promise.all([
      fetchJson<WeeklyRecord[]>(rodsUrl(), undefined, CDC_TIMEOUT_MS),
      fetchJson<WeeklyRecord[]>(nhiUrl(), undefined, CDC_TIMEOUT_MS),
    ]);

    const latest = latestYearWeek(rods);
    if (!latest) return ok("epidemic", NAME, [], false);
    const prev = previousYearWeek(latest.year, latest.week);
    const time = yearWeekToIso(latest.year, latest.week);

    const erLatest = sumByCounty(rods, latest.year, latest.week, "COVID-19急診就診人次");
    const erPrev = sumByCounty(rods, prev.year, prev.week, "COVID-19急診就診人次");
    const hospLatest = sumByCounty(
      nhi,
      latest.year,
      latest.week,
      "COVID-19健保就診人次",
      (r) => r["就診類別"] === "住院"
    );
    const outpatientLatest = sumByCounty(
      nhi,
      latest.year,
      latest.week,
      "COVID-19健保就診人次",
      (r) => r["就診類別"] === "門診"
    );

    const events: PulseEvent[] = [];
    for (const [county, erCount] of erLatest) {
      const severity = severityFromErVisits(erCount);
      if (!severity) continue; // below the display threshold — normal, not newsworthy

      const prevCount = erPrev.get(county) ?? 0;
      const trendPct = prevCount > 0 ? Math.round(((erCount - prevCount) / prevCount) * 100) : undefined;
      const trendText = trendPct === undefined ? "" : `較上週 ${trendPct >= 0 ? "+" : ""}${trendPct}%，`;
      const hosp = hospLatest.get(county) ?? 0;
      const outpatient = outpatientLatest.get(county) ?? 0;

      events.push({
        id: `epidemic-${county}-${latest.year}W${latest.week}`,
        category: "epidemic",
        title: `${county} COVID-19 急診就診 ${erCount} 人次`,
        description: `${trendText}健保門診 ${outpatient} 人次、住院 ${hosp} 人次（第 ${latest.year} 年第 ${latest.week} 週）`,
        severity,
        county,
        location: countyCentroid(county),
        time,
        source: NAME,
      });
    }
    return ok("epidemic", NAME, events, false);
  } catch (err) {
    return fail("epidemic", NAME, err, demoData());
  }
}
