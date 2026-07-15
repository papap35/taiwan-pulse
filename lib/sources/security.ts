import { PulseEvent } from "@/lib/types";
import { COUNTY_COORDS, countyCentroid } from "@/lib/counties";
import { fetchAllFeeds, getFeedUrls } from "./newsRss";
import { ok, fail, safeIso } from "./util";

// Taiwan has no publicly-available real-time criminal-case feed (privacy
// protections apply to individual cases). This source instead surfaces
// news-wire bulletins that mention security/crime keywords, clearly labeled
// as a news source rather than an official incident report.
const NAME = "新聞快訊（治安/刑案關鍵字過濾）";

const KEYWORDS = [
  "槍擊",
  "搶劫",
  "命案",
  "縱火",
  "詐騙",
  "重大刑案",
  "逮捕",
  "槍案",
  "殺人",
  "綁架",
  "爆裂物",
];

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-security-1",
      category: "security",
      title: "台中市西屯區 傳出槍響 警方封鎖現場調查（示範資料）",
      description: "新聞快訊，非官方即時個案資料",
      severity: "serious",
      county: "臺中市",
      location: countyCentroid("臺中市"),
      time: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

function findCounty(text: string): string | undefined {
  return Object.keys(COUNTY_COORDS).find((c) => text.includes(c));
}

// Untransformed upstream response, for /api/debug — see fire.ts's
// fetchFireRaw for why this is the unfiltered feed items, not final events.
export async function fetchSecurityRaw(): Promise<unknown> {
  const feeds = getFeedUrls();
  if (feeds.length === 0) throw new Error("NEWS_RSS_FEEDS not configured");
  return fetchAllFeeds(feeds);
}

export async function fetchSecurityEvents() {
  const feeds = getFeedUrls();
  const extra = (process.env.SECURITY_EXTRA_KEYWORDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const keywords = [...KEYWORDS, ...extra];
  if (feeds.length === 0) {
    return ok("security", NAME, demoData(), true);
  }
  try {
    const items = await fetchAllFeeds(feeds);
    const events: PulseEvent[] = items
      .filter((it) =>
        keywords.some((kw) => it.title.includes(kw) || (it.description ?? "").includes(kw))
      )
      .slice(0, 20)
      .map((it, idx) => {
        const county = findCounty(it.title);
        return {
          id: `security-news-${idx}-${it.link ?? it.title}`,
          category: "security" as const,
          title: it.title,
          description: it.description ? `${it.description}（新聞快訊，非官方個案資料）` : "新聞快訊，非官方個案資料",
          severity: "warning" as const,
          county,
          location: countyCentroid(county),
          time: safeIso(it.pubDate),
          source: NAME,
          sourceUrl: it.link,
        };
      });
    if (events.length === 0) return ok("security", NAME, [], false);
    return ok("security", NAME, events, false);
  } catch (err) {
    return fail("security", NAME, err, demoData());
  }
}
