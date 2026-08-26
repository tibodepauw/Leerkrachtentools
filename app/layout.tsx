import type { Metadata } from "next";
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
  title: "Leerkrachtentools · Thomas More",
  description:
    "AI-tools voor lesvoorbereiding, curriculumkoppeling en reflectie.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`${rubik.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-black text-neutral-100">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="dark" richColors />
      </body>
    </html>
  );
}
