import { PulseEvent, Severity } from "@/lib/types";
import { COUNTY_COORDS, countyCentroid } from "@/lib/counties";
import { endOfTaiwanDay } from "@/lib/freshness";
import { fetchRssItems } from "./newsRss";
import { ok, fail, safeIso } from "./util";

const NAME = "國家災害防救科技中心 - 天然災害停止上班及上課";
// The original guess (www.dgpa.gov.tw/typh/opendata/open.json) returned
// HTTP 404 in production and turned out to never have existed — the only
// real integration found for this data was HTML-table scraping of
// dgpa.gov.tw's public query page, not a JSON feed. The user found NCDR
// (國家災害防救科技中心) publishes the same official announcements as an
// RSS/Atom feed instead; AlertType=33 is the 停班停課 category.
const FEED_URL =
  process.env.NCDR_SUSPENSION_URL ??
  "https://alerts.ncdr.nat.gov.tw/RssAtomFeed.ashx?AlertType=33";

// Status codes used by DGPA's original feed varied by release, so this
// matches on the announcement text itself ("停止上班"/"停止上課") rather than
// a numeric code, to stay resilient regardless of which upstream produces it.
export function severityFromText(text: string): Severity {
  if (/停止上班.*停止上課|停班停課/.test(text)) return "serious";
  if (/停止上班|停止上課/.test(text)) return "warning";
  return "info";
}

function findCounty(text: string): string | undefined {
  return Object.keys(COUNTY_COORDS).find((c) => text.includes(c));
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

// Untransformed upstream response, for /api/debug — the parsed RSS items
// before keyword/severity filtering.
export async function fetchSuspensionRaw(): Promise<unknown> {
  return fetchRssItems(FEED_URL);
}

export async function fetchSuspension() {
  try {
    const items = await fetchRssItems(FEED_URL);
    const events: PulseEvent[] = [];
    for (const it of items) {
      const text = `${it.title} ${it.description ?? ""}`;
      const severity = severityFromText(text);
      if (severity === "info") continue; // feed noise / non-suspension entries
      const county = findCounty(text);
      events.push({
        id: `suspension-${it.link ?? `${it.title}-${it.pubDate ?? ""}`}`,
        category: "suspension",
        title: it.title,
        description: it.description,
        severity,
        county,
        location: countyCentroid(county),
        time: safeIso(it.pubDate),
        // NCDR's feed doesn't carry an explicit expiry either — same
        // convention as before: assume validity through end of the Taiwan
        // calendar day, replaced by the next day's announcement.
        validUntil: endOfTaiwanDay(),
        source: NAME,
        sourceUrl: it.link,
      });
    }
    return ok("suspension", NAME, events, false);
  } catch (err) {
    return fail("suspension", NAME, err, demoData());
  }
}
