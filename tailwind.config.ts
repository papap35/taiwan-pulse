import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        surface: {
          light: "#fcfcfb",
          dark: "#1a1a19",
        },
        page: {
          light: "#f9f9f7",
          dark: "#0d0d0d",
        },
        ink: {
          primary: {
            light: "#0b0b0b",
            dark: "#ffffff",
          },
          secondary: {
            light: "#52514e",
            dark: "#c3c2b7",
          },
          muted: "#898781",
        },
        gridline: {
          light: "#e1e0d9",
          dark: "#2c2c2a",
        },
        cat: {
          earthquake: { light: "#2a78d6", dark: "#3987e5" },
          flood: { light: "#1baf7a", dark: "#199e70" },
          weather: { light: "#eda100", dark: "#c98500" },
          traffic: { light: "#008300", dark: "#008300" },
          air: { light: "#4a3aa7", dark: "#9085e9" },
          fire: { light: "#e34948", dark: "#e66767" },
          security: { light: "#e87ba4", dark: "#d55181" },
        },
        status: {
          good: "#0ca30c",
          warning: "#fab219",
          serious: "#ec835a",
          critical: "#d03b3b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
