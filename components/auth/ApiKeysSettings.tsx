"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type ProviderName =
  | "google"
  | "groq"
  | "cerebras"
  | "sambanova"
  | "cloudflare";

interface ApiSettings {
  enabled: boolean;
  provider: ProviderName;
  model: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  cloudflareAccountId: string | null;
}

interface ListedModel {
  id: string;
  label: string;
}

const providerLabels: Record<ProviderName, string> = {
  google: "Google Gemini",
  groq: "Groq",
  cerebras: "Cerebras",
  sambanova: "SambaNova",
  cloudflare: "Cloudflare Workers AI",
};

export function ApiKeysSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [settings, setSettings] = useState<ApiSettings>({
    enabled: false,
    provider: "google",
    model: "",
    hasApiKey: false,
    apiKeyHint: null,
    cloudflareAccountId: null,
  });
  const [apiKey, setApiKey] = useState("");
  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [models, setModels] = useState<ListedModel[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const response = await fetch("/api/account/api-keys");
      if (cancelled) return;
      if (!response.ok) {
        toast.error("API-keyinstellingen konden niet worden geladen.");
        setLoading(false);
        return;
      }
      const payload = (await response.json()) as ApiSettings;
      if (cancelled) return;
      setSettings(payload);
      setCloudflareAccountId(payload.cloudflareAccountId ?? "");
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function detectModels() {
    setDetecting(true);
    try {
      const response = await fetch("/api/account/list-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey: apiKey.trim() || undefined,
          cloudflareAccountId:
            settings.provider === "cloudflare"
              ? cloudflareAccountId.trim() || undefined
              : undefined,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        models?: ListedModel[];
      };
      if (!response.ok) {
        toast.error(payload.error ?? "Modellen konden niet worden opgehaald.");
        return;
      }
      const detected = payload.models ?? [];
      setModels(detected);
      if (detected.length > 0) {
        setSettings((current) => ({
          ...current,
          model: detected.some((model) => model.id === current.model)
            ? current.model
            : detected[0]!.id,
        }));
      }
      toast.success(`${detected.length} model(len) gevonden.`);
    } catch {
      toast.error(
        "Modellen detecteren mislukt. Controleer je verbinding en probeer opnieuw.",
      );
    } finally {
      setDetecting(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/account/api-keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: settings.enabled,
        provider: settings.provider,
        model: settings.model,
        apiKey: apiKey.trim() || undefined,
        cloudflareAccountId:
          settings.provider === "cloudflare"
            ? cloudflareAccountId.trim()
            : undefined,
      }),
    });
    const payload = (await response.json()) as ApiSettings & { error?: string };
    setSaving(false);
    if (!response.ok) {
      toast.error(payload.error ?? "Instellingen konden niet worden opgeslagen.");
      return;
    }
    setSettings(payload);
    setApiKey("");
    toast.success(
      payload.enabled
        ? "API-keys opgeslagen en actief."
        : "API-keys uitgeschakeld.",
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API-keys</CardTitle>
          <CardDescription>Laden…</CardDescription>
        </CardHeader>
        <CardContent>
          <Loader2 className="size-5 animate-spin text-neutral-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          API-keys
        </CardTitle>
        <CardDescription>
          Gebruik je eigen provider voor testen. Standaard uit - dan worden de
          serverkeys gebruikt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={saveSettings} className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-800 p-3">
            <div>
              <Label htmlFor="use-own-keys" className="text-sm font-medium">
                API-keys gebruiken
              </Label>
              <p className="text-xs text-neutral-500">
                Keys worden versleuteld opgeslagen en nooit volledig getoond.
              </p>
            </div>
            <Switch
              id="use-own-keys"
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                setSettings((current) => ({ ...current, enabled: checked }))
              }
            />
          </div>

          {settings.enabled ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="ai-provider">Provider</Label>
                <Select
                  value={settings.provider}
                  onValueChange={(value) => {
                    setSettings((current) => ({
                      ...current,
                      provider: value as ProviderName,
                      model: "",
                    }));
                    setModels([]);
                  }}
                >
                  <SelectTrigger id="ai-provider" className="w-full">
                    <SelectValue placeholder="Kies provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(providerLabels) as ProviderName[]).map(
                      (provider) => (
                        <SelectItem key={provider} value={provider}>
                          {providerLabels[provider]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {settings.provider === "cloudflare" ? (
                <div className="space-y-2">
                  <Label htmlFor="cf-account">Cloudflare account ID</Label>
                  <Input
                    id="cf-account"
                    value={cloudflareAccountId}
                    onChange={(event) =>
                      setCloudflareAccountId(event.target.value)
                    }
                    placeholder="Account ID uit Cloudflare dashboard"
                    autoComplete="off"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="ai-api-key">
                  {settings.provider === "cloudflare"
                    ? "Cloudflare API-token"
                    : "API-key"}
                </Label>
                <Input
                  id="ai-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={
                    settings.hasApiKey && settings.apiKeyHint
                      ? `Opgeslagen (${settings.apiKeyHint}) - laat leeg om te behouden`
                      : "Plak je API-key"
                  }
                  autoComplete="off"
                />
              </div>

              <div className="@container/model-picker space-y-2">
                <Label htmlFor="ai-model">Model</Label>
                <div className="flex min-w-0 flex-col gap-2 @2xl/model-picker:flex-row @2xl/model-picker:items-stretch">
                  <Select
                    value={settings.model || undefined}
                    onValueChange={(value) =>
                      setSettings((current) => ({ ...current, model: value }))
                    }
                  >
                    <SelectTrigger id="ai-model" className="min-w-0 w-full">
                      <SelectValue placeholder="Selecteer model" />
                    </SelectTrigger>
                    <SelectContent position="popper" align="start" side="bottom">
                      {models.length > 0 ? (
                        models.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))
                      ) : settings.model ? (
                        <SelectItem value={settings.model}>
                          {settings.model}
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 w-full shrink-0 @2xl/model-picker:w-auto @2xl/model-picker:min-w-[11.5rem]"
                    disabled={detecting}
                    onClick={() => void detectModels()}
                  >
                    {detecting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    Modellen detecteren
                  </Button>
                </div>
              </div>
            </>
          ) : null}

          <Button disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            API-keys opslaan
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
