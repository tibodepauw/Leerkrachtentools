import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Rubik } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VisualThemeProvider } from "@/components/shared/VisualThemeProvider";
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=new URLSearchParams(location.search).get("theme");var t=q==="huisstijl"||q==="classic"?q:localStorage.getItem("lt-visual-theme");if(t==="huisstijl")document.documentElement.setAttribute("data-visual-theme","huisstijl");}catch(e){}})();`,
          }}
        />
        <VisualThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster theme="dark" richColors />
        </VisualThemeProvider>
      </body>
    </html>
  );
}
