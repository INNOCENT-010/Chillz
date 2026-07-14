import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { SplashScreen } from "@/components/layout/splash-screen";
import { RouterRefresh } from "@/components/ui/router-refresh";

export const metadata: Metadata = {
  title: "Chillz — Discover Lagos & Port Harcourt",
  description: "Discover the best events, bars, restaurants, clubs and more.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/chillz-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icon.svg",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#3A0080",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/chillz-icon.png" sizes="180x180" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Chillz" />
      </head>
      <body>
        <Providers>
          <SplashScreen />
          <RouterRefresh />
          {children}
        </Providers>
      <CookieConsent />
      </body>
    </html>
  );
}