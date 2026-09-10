import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taiwan Pulse - 台灣即時監控",
  description:
    "整合地震、天氣特報、空氣品質、交通、水利淹水、火災、治安快訊、停班停課、疫情監測與電力供需燈號的即時監控儀表板",
};

// Configurable so a staging/preview deployment can point at a different GA4
// property (or be disabled) without a code change — same pattern as every
// other external-service ID in this project. Falls back to the ID given at
// setup time so it works out of the box.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-Y8NYYK90ZD";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
