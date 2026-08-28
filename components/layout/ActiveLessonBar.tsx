"use client";

import { LogOut, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useLessonStore } from "@/stores/useLessonStore";
import type { EducationNetwork } from "@/types";

export function ActiveLessonBar({ userEmail }: { userEmail: string }) {
  const lesson = useLessonStore((state) => state.lesson);
  const setField = useLessonStore((state) => state.setField);
  const setGoal = useLessonStore((state) => state.setGoal);
  const setNetwork = useLessonStore((state) => state.setNetwork);
  const clearSession = useLessonStore((state) => state.clearSession);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-800 bg-black/90 backdrop-blur-xl">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 pl-16 lg:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">
              {lesson.topic || "Nieuwe les"}
            </p>
            <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
              {lesson.referenceSchoolYear}
            </Badge>
          </div>
          <p className="truncate text-xs text-neutral-500">
            {lesson.targetGroup || "Doelgroep nog niet ingevuld"} ·{" "}
            {lesson.goals.filter((goal) => goal.text).length}/3 doelen actief
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden max-w-44 truncate text-xs text-neutral-500 xl:inline">
            {userEmail}
          </span>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="size-4" />
                <span className="hidden sm:inline">Actieve les</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Actieve lescontext</DialogTitle>
                <DialogDescription>
                  Deze gegevens worden direct tussen alle tien modules gedeeld.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="topic">Lesonderwerp</Label>
                  <Input
                    id="topic"
                    value={lesson.topic}
                    onChange={(event) => setField("topic", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Doelgroep</Label>
                  <Input
                    id="target"
                    value={lesson.targetGroup}
                    onChange={(event) =>
                      setField("targetGroup", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Onderwijsnet</Label>
                  <Select
                    value={lesson.educationNetwork}
                    onValueChange={(value) =>
                      setNetwork(value as EducationNetwork)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ZILL">Katholiek · ZILL</SelectItem>
                      <SelectItem value="OVSG">OVSG · LeerLokaal</SelectItem>
                      <SelectItem value="GO">GO!</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="school-year">Referentieschooljaar</Label>
                  <Input
                    id="school-year"
                    value={lesson.referenceSchoolYear}
                    onChange={(event) =>
                      setField("referenceSchoolYear", event.target.value)
                    }
                    placeholder="2025-2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total-minutes">Totale lestijd (minuten)</Label>
                  <Input
                    id="total-minutes"
                    type="number"
                    min={1}
                    max={240}
                    value={lesson.totalMinutes}
                    onChange={(event) =>
                      setField(
                        "totalMinutes",
                        Math.max(1, Number(event.target.value) || 1),
                      )
                    }
                  />
                  <p className="text-xs text-neutral-500">
                    Standaard 50 min; kies bv. 45 of 60 min voor kortere of
                    langere lessen.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                {lesson.goals.map((goal, index) => (
                  <div key={goal.id} className="space-y-2">
                    <Label htmlFor={goal.id}>{goal.id}</Label>
                    <Input
                      id={goal.id}
                      value={goal.text}
                      onChange={(event) =>
                        setGoal(index, { text: event.target.value })
                      }
                      placeholder="De leerlingen kunnen..."
                    />
                  </div>
                ))}
              </div>
              <Button variant="ghost" onClick={clearSession} className="self-start">
                <RotateCcw className="size-4" />
                Sessie wissen
              </Button>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            aria-label="Uitloggen"
            title="Uitloggen"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
