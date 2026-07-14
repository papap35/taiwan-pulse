export type Category =
  | "earthquake"
  | "weather"
  | "air"
  | "traffic"
  | "flood"
  | "fire"
  | "security";

export type Severity = "info" | "warning" | "serious" | "critical";

export interface PulseEvent {
  id: string;
  category: Category;
  title: string;
  description?: string;
  severity: Severity;
  county?: string;
  location?: {
    lat: number;
    lng: number;
    name?: string;
  };
  time: string; // ISO 8601
  source: string;
  sourceUrl?: string;
  isDemo?: boolean;
}

export interface SourceStatus {
  category: Category;
  name: string;
  ok: boolean;
  isDemo: boolean;
  error?: string;
  count: number;
  fetchedAt: string;
}

export interface EventsResponse {
  events: PulseEvent[];
  sources: SourceStatus[];
  generatedAt: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  earthquake: "地震",
  weather: "天氣警特報",
  air: "空氣品質",
  traffic: "交通事件",
  flood: "水利淹水",
  fire: "火災消防",
  security: "治安快訊",
};

export const CATEGORY_ORDER: Category[] = [
  "earthquake",
  "flood",
  "weather",
  "traffic",
  "air",
  "fire",
  "security",
];

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "一般",
  warning: "注意",
  serious: "警戒",
  critical: "危急",
};
