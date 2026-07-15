export type Category =
  | "earthquake"
  | "weather"
  | "air"
  | "traffic"
  | "flood"
  | "fire"
  | "security"
  | "suspension";

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
