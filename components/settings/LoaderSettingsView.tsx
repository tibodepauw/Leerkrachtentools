"use client";

import { useEffect, useState } from "react";
import { Check, Play } from "lucide-react";
import { toast } from "sonner";
import { WordmarkLoader } from "@/components/shared/WordmarkLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WORDMARK_LOADER_VARIANTS,
  type WordmarkLoaderVariant,
} from "@/lib/wordmark/letters";
import { useSettingsStore } from "@/stores/useSettingsStore";

const FUN_VARIANTS = WORDMARK_LOADER_VARIANTS.filter((item) => item.id !== "gather");
const PREVIEW_ANIMATION_MS = 3200;

export function LoaderSettingsView() {
  const loaderVariant = useSettingsStore((state) => state.loaderVariant);
  const settingsHydrated = useSettingsStore((state) => state.hydrated);
  const setLoaderVariant = useSettingsStore((state) => state.setLoaderVariant);
  const [playing, setPlaying] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);

  function saveLoaderVariant(value: WordmarkLoaderVariant) {
    setLoaderVariant(value);
    toast.success("Laadscherm-animatie opgeslagen.");
    setSavedFlash(true);
  }

  useEffect(() => {
    if (!savedFlash) return;
    const timer = window.setTimeout(() => setSavedFlash(false), 2000);
    return () => window.clearTimeout(timer);
  }, [savedFlash]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPlaying(false), PREVIEW_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [playing, replayKey]);

  function playPreview() {
    setReplayKey((value) => value + 1);
    setPlaying(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Laadscherm</CardTitle>
        <CardDescription>
          Standaard is Gather. Kies een andere wordmark-animatie, puur voor de fun. Je keuze
          wordt automatisch opgeslagen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="wordmark-preview-frame flex min-h-[5.5rem] items-center justify-center rounded-xl border border-neutral-800 bg-black px-4 py-6">
          <WordmarkLoader
            key={playing ? replayKey : "static"}
            variant={playing ? loaderVariant : "static"}
            className="wordmark-loader--preview"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-loader-variant">Animatie</Label>
          <div className="flex gap-2">
            <Select
              value={loaderVariant}
              disabled={!settingsHydrated}
              onValueChange={(value) => saveLoaderVariant(value as WordmarkLoaderVariant)}
            >
              <SelectTrigger id="settings-loader-variant" className="min-w-0 flex-1">
                <SelectValue placeholder="Kies een animatie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gather">Gather (standaard)</SelectItem>
                {FUN_VARIANTS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 border-neutral-700 bg-transparent text-white hover:bg-neutral-900 hover:text-white"
              aria-label="Animatie afspelen"
              onClick={playPreview}
            >
              <Play className="size-4 fill-current" />
            </Button>
          </div>
          <p className="text-sm text-neutral-400">
            {
              WORDMARK_LOADER_VARIANTS.find((item) => item.id === loaderVariant)
                ?.description
            }
          </p>
          {savedFlash ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-400">
              <Check className="size-4" aria-hidden="true" />
              Opgeslagen — zichtbaar bij de volgende volledige laadbeurt.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
