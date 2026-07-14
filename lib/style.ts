import { Category, GridStatusLevel, Severity } from "@/lib/types";

// Categorical hues — fixed order, never reassigned/cycled (dataviz color-formula rule).
export const CATEGORY_COLORS: Record<Category, string> = {
  earthquake: "#2a78d6", // slot 1 blue
  flood: "#1baf7a", // slot 2 aqua
  weather: "#eda100", // slot 3 yellow
  traffic: "#008300", // slot 4 green
  air: "#4a3aa7", // slot 5 violet
  fire: "#e34948", // slot 6 red
  security: "#e87ba4", // slot 7 magenta
  suspension: "#eb6834", // slot 8 orange
};

export const CATEGORY_COLORS_DARK: Record<Category, string> = {
  earthquake: "#3987e5",
  flood: "#199e70",
  weather: "#c98500",
  traffic: "#008300",
  air: "#9085e9",
  fire: "#e66767",
  security: "#d55181",
  suspension: "#d95926",
};

// Status palette — fixed, never themed, always paired with icon + label.
export const SEVERITY_COLORS: Record<Severity, string> = {
  info: "#898781",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

export const SEVERITY_ICON: Record<Severity, string> = {
  info: "ℹ", // info icon
  warning: "⚠", // warning triangle
  serious: "❗", // exclamation
  critical: "☢", // hazard
};

// Full status palette (adds "good"), used for the grid-status banner which is
// a system gauge, not a categorical event — kept out of CATEGORY_COLORS.
export const GRID_STATUS_COLORS: Record<GridStatusLevel, string> = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

export const GRID_STATUS_ICON: Record<GridStatusLevel, string> = {
  good: "✓",
  warning: "⚠",
  serious: "❗",
  critical: "☢",
};
