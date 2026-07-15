import { PulseEvent } from "@/lib/types";
import { COUNTY_COORDS, countyCentroid } from "@/lib/counties";
import { fetchAllFeeds, getFeedUrls } from "./newsRss";
import { ok, fail } from "./util";

const NAME = "新聞快訊（火災/森林火災關鍵字過濾）";

const KEYWORDS = ["火災", "大火", "森林火災", "火警", "起火", "延燒", "工廠大火"];

function demoData(): PulseEvent[] {
  return [
    {
      id: "demo-fire-1",
      category: "fire",
      title: "南投縣仁愛鄉 森林火災延燒（示範資料）",
      description: "消防局出動空勤直升機灑水滅火",
      severity: "serious",
      county: "南投縣",
      location: countyCentroid("南投縣"),
      time: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      source: NAME,
      isDemo: true,
    },
  ];
}

function findCounty(text: string): string | undefined {
  return Object.keys(COUNTY_COORDS).find((c) => text.includes(c));
}

export async function fetchFireEvents() {
  const feeds = getFeedUrls();
  const extra = (process.env.FIRE_EXTRA_KEYWORDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const keywords = [...KEYWORDS, ...extra];
  if (feeds.length === 0) {
    return ok("fire", NAME, demoData(), true);
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
          id: `fire-news-${idx}-${it.link ?? it.title}`,
          category: "fire" as const,
          title: it.title,
          description: it.description,
          severity: "warning" as const,
          county,
          location: countyCentroid(county),
          time: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
          source: NAME,
          sourceUrl: it.link,
        };
      });
    if (events.length === 0) return ok("fire", NAME, [], false);
    return ok("fire", NAME, events, false);
  } catch (err) {
    return fail("fire", NAME, err, demoData());
  }
}
