import { XMLParser } from "fast-xml-parser";
import { fetchText } from "./util";

export interface RssItem {
  title: string;
  link?: string;
  pubDate?: string;
  description?: string;
}

const parser = new XMLParser({ ignoreAttributes: false });

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export async function fetchRssItems(feedUrl: string): Promise<RssItem[]> {
  const xml = await fetchText(feedUrl);
  const parsed = parser.parse(xml);
  const channelItems = parsed?.rss?.channel?.item;
  const feedEntries = parsed?.feed?.entry; // Atom fallback
  if (channelItems) {
    return asArray(channelItems).map((it: Record<string, unknown>) => ({
      title: String(it.title ?? ""),
      link: typeof it.link === "string" ? it.link : undefined,
      pubDate: typeof it.pubDate === "string" ? it.pubDate : undefined,
      description: typeof it.description === "string" ? it.description : undefined,
    }));
  }
  if (feedEntries) {
    return asArray(feedEntries).map((it: Record<string, unknown>) => {
      const link = it.link as { "@_href"?: string } | undefined;
      return {
        title: String(it.title ?? ""),
        link: link?.["@_href"],
        pubDate: typeof it.updated === "string" ? it.updated : undefined,
        description: typeof it.summary === "string" ? it.summary : undefined,
      };
    });
  }
  return [];
}

export async function fetchAllFeeds(feedUrls: string[]): Promise<RssItem[]> {
  const results = await Promise.allSettled(feedUrls.map((u) => fetchRssItems(u)));
  const items: RssItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }
  return items;
}

export function getFeedUrls(): string[] {
  return (process.env.NEWS_RSS_FEEDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
