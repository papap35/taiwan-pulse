export type Category =
  | "earthquake"
  | "weather"
  | "air"
  | "traffic"
  | "flood"
  | "fire"
  | "security"
  | "suspension"
  | "epidemic";

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
  // Optional short line segment near `location` for events tied to a road
  // stretch (currently only traffic.ts). This is a coarse approximation of
  // the road's local direction, not the real road geometry (Taiwan Pulse
  // doesn't have road-shape data — see SPEC.md P2-6.5) — good enough to
  // visually distinguish "a stretch of road" from a single point.
  route?: { lat: number; lng: number }[];
  time: string; // ISO 8601 — 發布/觀測時間
  validUntil?: string; // ISO 8601 — 官方標示的有效期限（例如天氣特報的解除時間），來源沒有提供時留空
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

export type GridStatusLevel = "good" | "warning" | "serious" | "critical";

export interface GridStatus {
  level: GridStatusLevel;
  label: string;
  detail?: string;
  updatedAt: string;
  source: string;
  isDemo: boolean;
  ok: boolean;
  error?: string;
}

export interface EventsResponse {
  events: PulseEvent[];
  sources: SourceStatus[];
  gridStatus: GridStatus;
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
  suspension: "停班停課",
  epidemic: "疫情監測",
};

export const CATEGORY_ORDER: Category[] = [
  "earthquake",
  "flood",
  "weather",
  "traffic",
  "air",
  "fire",
  "security",
  "suspension",
  "epidemic",
];

export const GRID_STATUS_LABELS: Record<GridStatusLevel, string> = {
  good: "供電充裕",
  warning: "供電吃緊",
  serious: "限電警戒",
  critical: "限電準備",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "一般",
  warning: "注意",
  serious: "警戒",
  critical: "危急",
};
