"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/useSettingsStore";

export function SettingsView() {
  const enableLlmQueryRewriting = useSettingsStore(
    (state) => state.enableLlmQueryRewriting,
  );
  const setEnableLlmQueryRewriting = useSettingsStore(
    (state) => state.setEnableLlmQueryRewriting,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zoeken in leerplannen</CardTitle>
        <CardDescription>
          Optionele AI-verrijking voor Leerplandoelen en Minimumdoelen.
        </CardDescription>
      </CardHeader>
      <CardContent className="@container">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <Label
              htmlFor="settings-llm-query-rewriting"
              className="font-normal leading-5 text-neutral-100"
            >
              Slimme AI-zoekherformulering (LLM Query Rewriting)
            </Label>
            <p className="text-sm leading-6 text-neutral-400">
              Herschrijft vage zoekopdrachten en typefouten automatisch via Gemini
              3.5 Flash Lite voor de RAG-zoekmotor (+30 ms).
            </p>
          </div>
          <Switch
            id="settings-llm-query-rewriting"
            checked={enableLlmQueryRewriting}
            onCheckedChange={setEnableLlmQueryRewriting}
            aria-label="Slimme AI-zoekherformulering inschakelen"
            className="shrink-0"
          />
        </div>
      </CardContent>
    </Card>
  );
}
