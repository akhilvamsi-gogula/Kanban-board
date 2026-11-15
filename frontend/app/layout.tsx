import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Self-hosted at build time by next/font, so no render-blocking request to Google Fonts.
const bodyFont = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kanban board",
  description: "Private Kanban boards with drag-and-drop cards and an AI co-pilot.",
};

// Shrink the layout (not just the visual viewport) when the on-screen keyboard opens, so the
// fixed AI panel's composer and dialog buttons stay above the keyboard on Android.
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}>
      <body>{children}</body>
    </html>
  );
}
