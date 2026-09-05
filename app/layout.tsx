import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Rubik } from "next/font/google";
import { connection } from "next/server";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Leerkrachtentools",
  applicationName: "Leerkrachtentools",
  description:
    "AI-tools voor lesvoorbereiding, leerplandoelenkoppeling en reflectie.",
  appleWebApp: {
    capable: true,
    title: "Leerkrachtentools",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  return (
    <html
      lang="nl"
      suppressHydrationWarning
      className={`${rubik.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full bg-black text-neutral-100">
        <div className="lt-app">
          <PwaRegister />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster theme="dark" richColors />
        </div>
      </body>
    </html>
  );
}
