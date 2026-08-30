"use client";

import { WordmarkLoader } from "@/components/shared/WordmarkLoader";
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

export function LoaderSettingsView() {
  const loaderVariant = useSettingsStore((state) => state.loaderVariant);
  const setLoaderVariant = useSettingsStore((state) => state.setLoaderVariant);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Laadscherm</CardTitle>
        <CardDescription>
          Standaard is Gather. Kies een andere wordmark-animatie — puur voor de fun.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex min-h-[5.5rem] items-center justify-center rounded-xl border border-neutral-800 bg-black px-4 py-6">
          <WordmarkLoader key={loaderVariant} variant={loaderVariant} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-loader-variant">Animatie</Label>
          <Select
            value={loaderVariant}
            onValueChange={(value) => setLoaderVariant(value as WordmarkLoaderVariant)}
          >
            <SelectTrigger id="settings-loader-variant" className="w-full">
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
          <p className="text-sm text-neutral-400">
            {
              WORDMARK_LOADER_VARIANTS.find((item) => item.id === loaderVariant)
                ?.description
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
