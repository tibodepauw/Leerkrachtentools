"use client";

import { FormEvent, useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLessonStore } from "@/stores/useLessonStore";
import type { FeedbackKind } from "@/lib/feedback/feedback";

export function SidebarFeedback({
  userEmail,
  collapsed = false,
}: {
  userEmail: string;
  collapsed?: boolean;
}) {
  const activeModule = useLessonStore((state) => state.activeModule);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittingMode, setSubmittingMode] = useState<"named" | "anonymous" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submitFeedback(sendAnonymous: boolean) {
    setLoading(true);
    setSubmittingMode(sendAnonymous ? "anonymous" : "named");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message,
          activeModule,
          anonymous: sendAnonymous,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Feedback versturen is mislukt.");
      }

      setSuccess(payload.message ?? "Bedankt! Je feedback is doorgestuurd.");
      setMessage("");
      setKind("idea");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Feedback versturen is mislukt.",
      );
    } finally {
      setLoading(false);
      setSubmittingMode(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await submitFeedback(false);
  }

  return (
    <section className={cn("border-t border-neutral-800/80", collapsed ? "pt-2" : "pt-4")}>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setError("");
            setSuccess("");
          }
        }}
      >
        <DialogTrigger asChild>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Idee of feedback"
                  className="grid size-10 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-neutral-100"
                >
                  <Lightbulb className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Idee of feedback</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-full px-3 py-2 text-left text-sm text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-neutral-100"
            >
              <Lightbulb className="size-4 shrink-0" />
              <span>Idee of feedback</span>
            </button>
          )}
        </DialogTrigger>
        <DialogContent className="border-neutral-800 bg-neutral-950 p-6 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Idee of feedback</DialogTitle>
            <DialogDescription>
              Deel een idee, bug of algemene feedback. Kies zelf of je e-mailadres
              meegestuurd wordt.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="feedback-kind">Type</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as FeedbackKind)}
              >
                <SelectTrigger id="feedback-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idee voor een nieuwe tool</SelectItem>
                  <SelectItem value="feedback">Algemene feedback</SelectItem>
                  <SelectItem value="bug">Bug of probleem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-message">Bericht</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Beschrijf je idee, wat je mist, of wat niet goed werkt…"
                rows={8}
                maxLength={4000}
                required
                className="field-sizing-fixed min-h-[12rem] resize-y"
              />
              <p className="text-xs text-neutral-500">
                Minstens 10 tekens. Kies hieronder of je anoniem verstuurt.
              </p>
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={loading || message.trim().length < 10}
                onClick={() => void submitFeedback(true)}
              >
                {loading && submittingMode === "anonymous" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Anoniem versturen
              </Button>
              <Button
                type="submit"
                disabled={loading || message.trim().length < 10}
              >
                {loading && submittingMode === "named" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Versturen als {userEmail.split("@")[0]}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
