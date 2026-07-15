import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taiwan Pulse - 台灣即時監控",
  description:
    "整合地震、天氣特報、空氣品質、交通、水利淹水、火災、治安快訊、停班停課、疫情監測與電力供需燈號的即時監控儀表板",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
