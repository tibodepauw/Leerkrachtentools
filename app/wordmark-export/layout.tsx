import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Wordmark export",
  robots: { index: false, follow: false },
};

export default function WordmarkExportLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
