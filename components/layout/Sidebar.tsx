"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  ScanText,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/shared/ProfileAvatar";
import { tierBadgeLabel } from "@/components/shared/TierBadge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { hasModuleAccess } from "@/lib/auth/moduleAccess";
import { useSidebarLayout } from "@/hooks/useSidebarLayout";
import { useLessonStore } from "@/stores/useLessonStore";
import { SidebarFeedback } from "@/components/layout/SidebarFeedback";
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
      { id: "goal-taxonomy", label: "MC-DAS-SPM herkenner", icon: Brain },
      { id: "curriculum-rag", label: "Leerplandoelen", icon: BookOpenCheck },
      { id: "minimum-goals", label: "Minimumdoelen", icon: Landmark },
    ],
  },
  {
    label: "Lesvoorbereiding",
    items: [
      {
        id: "dialogue-formatter",
        label: "Schrijfstijl",
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

type SidebarModule = {
  id: ModuleId;
  label: string;
  icon: typeof FileScan;
};

const moduleCatalog: SidebarModule[] = sections.flatMap((section) =>
  section.items.map((item) => item as SidebarModule),
);

function moduleById(id: ModuleId): SidebarModule | undefined {
  return moduleCatalog.find((item) => item.id === id);
}

function ModuleNavButton({
  item,
  active,
  pinned,
  collapsed,
  pinnable = true,
  onOpen,
  onTogglePin,
}: {
  item: SidebarModule;
  active: boolean;
  pinned: boolean;
  collapsed: boolean;
  pinnable?: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
}) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            aria-label={item.label}
            className={cn(
              "relative mx-auto grid size-10 place-items-center rounded-full transition-colors",
              active
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100",
            )}
          >
            <item.icon className="size-4" />
            {pinned ? (
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-white" />
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      className={cn(
        "group/nav flex w-full items-center gap-1 rounded-full pr-1 transition-colors",
        active ? "bg-neutral-800" : "hover:bg-neutral-900",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-full px-3 py-2 text-left text-sm transition-colors",
          active ? "text-white" : "text-neutral-400 group-hover/nav:text-neutral-100",
        )}
      >
        <item.icon className="size-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </button>
      {pinnable ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={pinned ? "Losmaken uit zijbalk" : "Pin in zijbalk"}
              aria-pressed={pinned}
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin();
              }}
              className={cn(
                "mr-1 grid size-7 shrink-0 place-items-center rounded-full opacity-0 transition-all group-hover/nav:opacity-100 focus-visible:opacity-100",
                pinned
                  ? "text-white hover:bg-neutral-800 hover:text-white"
                  : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300",
              )}
            >
              <Pin className={cn("size-3.5", pinned && "fill-current")} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {pinned ? "Losmaken" : "Pin bovenaan"}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

interface AccountSummary {
  email: string;
  displayName: string | null;
  tier: string;
  profileImageUrl?: string | null;
}

function accountLabel(account: AccountSummary) {
  return account.displayName || account.email.split("@")[0];
}

function SidebarContent({
  account,
  collapsed,
  onNavigate,
}: {
  account: AccountSummary;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isSettings = pathname === "/settings";
  const activeModule = useLessonStore((state) => state.activeModule);
  const pinnedModules = useLessonStore((state) => state.pinnedModules);
  const setActiveModule = useLessonStore((state) => state.setActiveModule);
  const togglePinnedModule = useLessonStore((state) => state.togglePinnedModule);
  const { toggleCollapsed } = useSidebarLayout();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const pinnedItems = pinnedModules
    .map((id) => moduleById(id))
    .filter(
      (item): item is SidebarModule =>
        item !== undefined && hasModuleAccess(account.tier, item.id),
    );
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasModuleAccess(account.tier, item.id)),
    }))
    .filter((section) => section.items.length > 0);
  const showActiveLesson = hasModuleAccess(account.tier, "active-lesson");

  function updateBottomFade() {
    const element = scrollRef.current;
    if (!element) return;

    const hasOverflow = element.scrollHeight > element.clientHeight + 1;
    const atBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
    setShowBottomFade(hasOverflow && !atBottom);
  }

  useEffect(() => {
    updateBottomFade();
    window.addEventListener("resize", updateBottomFade);

    const element = scrollRef.current;
    if (!element) {
      return () => window.removeEventListener("resize", updateBottomFade);
    }

    const observer = new ResizeObserver(updateBottomFade);
    observer.observe(element);
    const nav = element.firstElementChild;
    if (nav) observer.observe(nav);

    return () => {
      window.removeEventListener("resize", updateBottomFade);
      observer.disconnect();
    };
  }, [collapsed]);

  function openModule(moduleId: ModuleId) {
    setActiveModule(moduleId);
    if (isSettings) router.push("/");
    onNavigate?.();
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full min-h-0 flex-col bg-neutral-950">
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-neutral-800",
            collapsed ? "justify-center px-2" : "px-5",
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label="Zijbalk uitvouwen"
                  className="grid size-10 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-neutral-100"
                >
                  <PanelLeftOpen className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Zijbalk uitvouwen</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex w-full min-w-0 items-center justify-between gap-2">
              <p className="truncate text-sm font-black tracking-tight">
                Leerkrachtentools
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleCollapsed}
                    aria-label="Zijbalk invouwen"
                    className="grid size-8 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-neutral-100"
                  >
                    <PanelLeftClose className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Zijbalk invouwen</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={updateBottomFade}
            className="h-full overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-track]:bg-transparent"
          >
            <nav className={cn("space-y-6 pb-4", collapsed ? "p-2" : "p-3")}>
              {showActiveLesson ? (
                collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => openModule("active-lesson")}
                        aria-label="Actieve les"
                        className={cn(
                          "mx-auto grid size-10 place-items-center rounded-full transition-colors",
                          !isSettings && activeModule === "active-lesson"
                            ? "bg-neutral-800 text-white"
                            : "text-neutral-300 hover:bg-neutral-900 hover:text-white",
                        )}
                      >
                        <FileText className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Actieve les</TooltipContent>
                  </Tooltip>
                ) : (
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
                )
              ) : null}
              {pinnedItems.length > 0 ? (
                <section>
                  {!collapsed ? (
                    <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
                      Gepind
                    </p>
                  ) : null}
                  <div className={cn("space-y-1", collapsed && "space-y-2")}>
                    {pinnedItems.map((item) => (
                      <ModuleNavButton
                        key={`pinned-${item.id}`}
                        item={item}
                        active={!isSettings && activeModule === item.id}
                        pinned
                        collapsed={collapsed}
                        onOpen={() => openModule(item.id)}
                        onTogglePin={() => togglePinnedModule(item.id)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              {visibleSections.map((section) => (
                <section key={section.label}>
                  {!collapsed ? (
                    <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
                      {section.label}
                    </p>
                  ) : null}
                  <div className={cn("space-y-1", collapsed && "space-y-2")}>
                    {section.items.map((item) => (
                      <ModuleNavButton
                        key={item.id}
                        item={item}
                        active={!isSettings && activeModule === item.id}
                        pinned={pinnedModules.includes(item.id)}
                        collapsed={collapsed}
                        onOpen={() => openModule(item.id)}
                        onTogglePin={() => togglePinnedModule(item.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
              <SidebarFeedback userEmail={account.email} collapsed={collapsed} />
            </nav>
          </div>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-neutral-950 via-neutral-950/90 to-transparent transition-opacity duration-200",
              showBottomFade ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
        <div
          className={cn(
            "shrink-0 border-t border-neutral-800 bg-neutral-950",
            collapsed ? "p-2" : "p-3",
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings"
                  onClick={onNavigate}
                  className={cn(
                    "mx-auto grid size-10 place-items-center rounded-full transition-colors hover:bg-neutral-900",
                    isSettings && "bg-neutral-800",
                  )}
                  aria-label="Instellingen"
                >
                  <ProfileAvatar
                    email={account.email}
                    displayName={account.displayName}
                    profileImageUrl={account.profileImageUrl}
                    sizeClassName="size-8"
                    fallbackClassName="text-[10px] font-semibold text-white"
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                {accountLabel(account)} · {tierBadgeLabel(account.tier)}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/settings"
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-neutral-900",
                isSettings && "bg-neutral-800",
              )}
            >
              <ProfileAvatar
                email={account.email}
                displayName={account.displayName}
                profileImageUrl={account.profileImageUrl}
                sizeClassName="size-9"
                fallbackClassName="text-xs font-semibold text-white"
              />
              <div className="min-w-0 flex-1 leading-none">
                <p className="truncate text-sm font-medium text-white">
                  {accountLabel(account)}
                </p>
                <p className="truncate text-xs font-normal text-neutral-500">
                  {tierBadgeLabel(account.tier)}
                </p>
              </div>
              <Settings className="size-4 text-neutral-600 transition-colors group-hover:text-neutral-300" />
            </Link>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function SidebarResizeHandle() {
  const { startResize, toggleCollapsed, isResizing } = useSidebarLayout();

  return (
    <button
      type="button"
      aria-label="Zijbalk breedte aanpassen"
      onMouseDown={(event) => {
        event.preventDefault();
        startResize(event.clientX);
      }}
      onDoubleClick={toggleCollapsed}
      className={cn(
        "absolute inset-y-0 -right-1 z-40 w-2 cursor-col-resize touch-none",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-neutral-800 after:transition-colors",
        "hover:after:bg-neutral-600 focus-visible:after:bg-neutral-500",
        isResizing && "after:bg-neutral-500",
      )}
    />
  );
}

export function Sidebar({ account }: { account: AccountSummary }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { width, collapsed, isResizing } = useSidebarLayout();

  return (
    <>
      <aside
        style={{ width }}
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-neutral-800 lg:block",
          !isResizing && "transition-[width] duration-200 ease-out",
        )}
      >
        <SidebarContent account={account} collapsed={collapsed} />
        <SidebarResizeHandle />
      </aside>
      <div className="fixed left-3 top-3 z-50 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Open navigatie">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="h-full w-72 border-neutral-800 p-0">
            <SidebarContent
              account={account}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

export function SidebarMain({ children }: { children: ReactNode }) {
  const { width, isResizing } = useSidebarLayout();

  return (
    <div
      style={{ ["--sidebar-width" as string]: `${width}px` }}
      className={cn(
        "lg:pl-[var(--sidebar-width)]",
        !isResizing && "transition-[padding] duration-200 ease-out",
      )}
    >
      {children}
    </div>
  );
}
