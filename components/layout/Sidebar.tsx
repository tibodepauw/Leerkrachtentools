"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AudioLines,
  BookOpenCheck,
  Brain,
  Braces,
  ClipboardCheck,
  Clock3,
  FileScan,
  FileText,
  Landmark,
  Menu,
  MessageSquareQuote,
  ScanText,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useLessonStore } from "@/stores/useLessonStore";
import type { ModuleId } from "@/types";

const sections = [
  {
    label: "Input",
    items: [
      { id: "manual-scanner", label: "Handleiding Scanner", icon: FileScan },
    ],
  },
  {
    label: "Doelen",
    items: [
      { id: "goal-optimizer", label: "Doelverbeteraar", icon: Target },
      { id: "goal-taxonomy", label: "MC–DAS–SPM herkenner", icon: Brain },
      { id: "curriculum-rag", label: "Leerplandoelen", icon: BookOpenCheck },
      { id: "minimum-goals", label: "Minimumdoelen", icon: Landmark },
    ],
  },
  {
    label: "Lesvoorbereiding",
    items: [
      {
        id: "dialogue-formatter",
        label: "Thomas More stijl",
        icon: MessageSquareQuote,
      },
      { id: "spellcheck", label: "Taalfoutencheck", icon: ScanText },
      { id: "timing-check", label: "Timing", icon: Clock3 },
    ],
  },
  {
    label: "Kwaliteitscontrole",
    items: [
      { id: "alignment", label: "Doel-activiteit", icon: Braces },
      { id: "engagement", label: "Betrokkenheid", icon: Sparkles },
      { id: "full-audit", label: "Totale audit", icon: ClipboardCheck },
    ],
  },
  {
    label: "Na de les",
    items: [
      { id: "voice-reflection", label: "Voice-reflectie", icon: AudioLines },
    ],
  },
] satisfies Array<{
  label: string;
  items: Array<{
    id: ModuleId;
    label: string;
    icon: typeof FileScan;
  }>;
}>;

interface AccountSummary {
  email: string;
  displayName: string | null;
  tier: string;
}

function accountLabel(account: AccountSummary) {
  return account.displayName || account.email.split("@")[0];
}

function initials(account: AccountSummary) {
  return accountLabel(account)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("nl-BE"))
    .join("");
}

function SidebarContent({
  account,
  onNavigate,
}: {
  account: AccountSummary;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isSettings = pathname === "/settings";
  const activeModule = useLessonStore((state) => state.activeModule);
  const setActiveModule = useLessonStore((state) => state.setActiveModule);

  function openModule(moduleId: ModuleId) {
    setActiveModule(moduleId);
    if (isSettings) router.push("/");
    onNavigate?.();
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      <div className="flex h-16 items-center border-b border-neutral-800 px-5">
        <p className="text-sm font-black tracking-tight">Leerkrachtentools</p>
      </div>
      <ScrollArea className="flex-1">
        <nav className="space-y-6 p-3">
          <button
            type="button"
            onClick={() => openModule("active-lesson")}
            className={cn(
              "flex w-full items-center gap-3 rounded-full px-3 py-2 text-left text-sm font-medium transition-colors",
              !isSettings && activeModule === "active-lesson"
                ? "bg-neutral-800 text-white"
                : "text-neutral-300 hover:bg-neutral-900 hover:text-white",
            )}
          >
            <FileText className="size-4 shrink-0" />
            <span>Actieve les</span>
          </button>
          {sections.map((section) => (
            <section key={section.label}>
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openModule(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-full px-3 py-2 text-left text-sm transition-colors",
                      !isSettings && activeModule === item.id
                        ? "bg-neutral-800 text-white"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t border-neutral-800 p-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-neutral-900",
            isSettings && "bg-neutral-800",
          )}
        >
          <Avatar
            key={accountLabel(account)}
            className="size-9 border border-neutral-700"
          >
            <AvatarFallback className="bg-neutral-800 text-xs font-semibold text-white">
              {initials(account)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {accountLabel(account)}
            </p>
            <p className="text-xs capitalize text-neutral-500">
              {account.tier === "free" ? "Gratis" : account.tier}
            </p>
          </div>
          <Settings className="size-4 text-neutral-600 transition-colors group-hover:text-neutral-300" />
        </Link>
      </div>
    </div>
  );
}

export function Sidebar({ account }: { account: AccountSummary }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-neutral-800 lg:block">
        <SidebarContent account={account} />
      </aside>
      <div className="fixed left-3 top-3 z-50 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Open navigatie">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-neutral-800 p-0">
            <SidebarContent
              account={account}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
