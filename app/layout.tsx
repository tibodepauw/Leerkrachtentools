import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Rubik } from "next/font/google";
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
  description:
    "AI-tools voor lesvoorbereiding, leerplandoelenkoppeling en reflectie.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="nl"
      suppressHydrationWarning
      className={`${rubik.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full bg-black text-neutral-100">
        <div className="lt-app">
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster theme="dark" richColors />
        </div>
      </body>
    </html>
  );
}
