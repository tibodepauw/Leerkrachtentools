"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getActiveUserId } from "@/lib/storage/userStorageScope";

export const SIDEBAR_DEFAULT_WIDTH = 320;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 360;
export const SIDEBAR_COLLAPSED_WIDTH = 72;
export const SIDEBAR_COLLAPSE_THRESHOLD = 140;

const STORAGE_BASE_KEY = "leerkrachtentools-sidebar-width";

type SidebarLayoutContextValue = {
  width: number;
  collapsed: boolean;
  isResizing: boolean;
  setWidth: (width: number) => void;
  toggleCollapsed: () => void;
  startResize: (clientX: number) => void;
};

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(
  null,
);

function storageKey() {
  const userId = getActiveUserId();
  return userId ? `${STORAGE_BASE_KEY}:${userId}` : STORAGE_BASE_KEY;
}

function readStoredWidth(): number {
  if (typeof window === "undefined") {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  const raw = window.localStorage.getItem(storageKey());
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  return Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(SIDEBAR_MIN_WIDTH, Math.round(parsed)),
  );
}

function writeStoredWidth(width: number) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey(), String(width));
}

function clampExpandedWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

export function SidebarLayoutProvider({ children }: { children: ReactNode }) {
  const [expandedWidth, setExpandedWidth] = useState(() =>
    typeof window === "undefined" ? SIDEBAR_DEFAULT_WIDTH : readStoredWidth(),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [hydrated] = useState(() => typeof window !== "undefined");

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : expandedWidth;

  const setWidth = useCallback((nextWidth: number) => {
    if (nextWidth <= SIDEBAR_COLLAPSE_THRESHOLD) {
      setCollapsed(true);
      return;
    }

    const clamped = clampExpandedWidth(nextWidth);
    setCollapsed(false);
    setExpandedWidth(clamped);
    writeStoredWidth(clamped);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      if (current) {
        return false;
      }
      return true;
    });
  }, []);

  const startResize = useCallback((clientX: number) => {
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function handleMove(event: MouseEvent) {
      setWidth(event.clientX);
    }

    function handleUp(event: MouseEvent) {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (event.clientX <= SIDEBAR_COLLAPSE_THRESHOLD) {
        setCollapsed(true);
      } else {
        const clamped = clampExpandedWidth(event.clientX);
        setCollapsed(false);
        setExpandedWidth(clamped);
        writeStoredWidth(clamped);
      }
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    setWidth(clientX);
  }, [setWidth]);

  const value = useMemo(
    () => ({
      width: hydrated ? width : SIDEBAR_DEFAULT_WIDTH,
      collapsed: hydrated ? collapsed : false,
      isResizing,
      setWidth,
      toggleCollapsed,
      startResize,
    }),
    [
      collapsed,
      hydrated,
      isResizing,
      setWidth,
      startResize,
      toggleCollapsed,
      width,
    ],
  );

  return (
    <SidebarLayoutContext.Provider value={value}>
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function useSidebarLayout() {
  const context = useContext(SidebarLayoutContext);
  if (!context) {
    throw new Error("useSidebarLayout must be used within SidebarLayoutProvider.");
  }
  return context;
}
