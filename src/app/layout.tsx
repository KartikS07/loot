import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AnalyticsBoot } from "@/components/AnalyticsBoot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loot — Not just a deal. A loot.",
  description: "AI-powered shopping assistant for India. Find the right product at the best price across 12 platforms in under 90 seconds.",
  openGraph: {
    title: "Loot — Not just a deal. A loot.",
    description: "Stop overpaying. Loot scans Amazon, Flipkart, Croma and 9 more platforms, applies your bank card discounts, and tells you exactly when and where to buy.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#050505]">
        <AnalyticsBoot />
        {children}
      </body>
    </html>
  );
}
