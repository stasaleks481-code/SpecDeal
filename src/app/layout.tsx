import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpecDeal — Telegram Bot",
  description: "Экономический симулятор автодилера, гаража, тюнинга, аукционов и гонок в Telegram.",
  keywords: ["SpecDeal", "Telegram bot", "автосимулятор", "grammY", "Supabase", "Next.js"],
  authors: [{ name: "SpecDeal Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "SpecDeal",
    description: "Telegram-бот — экономический симулятор автодилера и гонок",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "SpecDeal",
    description: "Telegram-бот — экономический симулятор автодилера и гонок",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
