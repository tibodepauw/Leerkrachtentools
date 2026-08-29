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
import { useLessonStore } from "@/stores/useLessonStore";
import type { FeedbackKind } from "@/lib/feedback/feedback";

export function SidebarFeedback({ userEmail }: { userEmail: string }) {
  const activeModule = useLessonStore((state) => state.activeModule);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
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
    }
  }

  return (
    <section className="border-t border-neutral-800/80 pt-4">
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
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-full px-3 py-2 text-left text-sm text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-neutral-100"
          >
            <Lightbulb className="size-4 shrink-0" />
            <span>Idee of feedback</span>
          </button>
        </DialogTrigger>
        <DialogContent className="border-neutral-800 bg-neutral-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Idee of feedback</DialogTitle>
            <DialogDescription>
              Deel een idee, bug of algemene feedback. We sturen dit door met
              je ingelogde e-mailadres zodat we kunnen antwoorden.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                rows={5}
                maxLength={4000}
                required
                className="field-sizing-fixed min-h-[7rem] resize-y"
              />
              <p className="text-xs text-neutral-500">
                Verstuurd als {userEmail}. Minstens 10 tekens.
              </p>
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={loading || message.trim().length < 10}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                Versturen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
