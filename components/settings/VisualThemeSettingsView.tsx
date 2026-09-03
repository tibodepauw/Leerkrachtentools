"use client";

import { useVisualTheme } from "@/components/shared/VisualThemeProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function VisualThemeSettingsView() {
  const { theme, setTheme } = useVisualTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visueel thema</CardTitle>
        <CardDescription>
          Test de Generative Labs huisstijl op de echte app. Het huidige design blijft
          de standaard. Je keuze blijft bewaard in deze browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={theme === "classic" ? "default" : "outline"}
          onClick={() => setTheme("classic")}
        >
          Huidig design
        </Button>
        <Button
          type="button"
          variant={theme === "huisstijl" ? "default" : "outline"}
          onClick={() => setTheme("huisstijl")}
        >
          Huisstijl
        </Button>
        <a
          href="/HuisstijlV1.html"
          className="inline-flex h-8 items-center rounded-full border border-neutral-700 px-3 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
        >
          Brand kit
        </a>
      </CardContent>
    </Card>
  );
}
