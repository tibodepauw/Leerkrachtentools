"use client";

import { useEffect } from "react";
import { ActiveLessonBar } from "@/components/layout/ActiveLessonBar";
import { AppShell } from "@/components/layout/AppShell";
import { useModuleAccess } from "@/components/auth/ModuleAccessProvider";
import { LoadingGate } from "@/components/shared/LoadingGate";
import { ModuleAccessDeniedCard } from "@/components/shared/ModuleShell";
import { PreparationTextSync } from "@/components/shared/PreparationTextSync";
import { ActiveLessonView } from "@/components/modules/ActiveLessonView";
import { AlignmentAuditView } from "@/components/modules/AlignmentAuditView";
import {
  CurriculumRagView,
  MinimumGoalsView,
} from "@/components/modules/CurriculumRagView";
import { DialogueFormatterView } from "@/components/modules/DialogueFormatterView";
import { EngagementView } from "@/components/modules/EngagementView";
import { FullAuditView } from "@/components/modules/FullAuditView";
import { GoalOptimizerView } from "@/components/modules/GoalOptimizerView";
import { GoalTaxonomyView } from "@/components/modules/GoalTaxonomyView";
import { ManualScannerView } from "@/components/modules/ManualScannerView";
import { SpellcheckView } from "@/components/modules/SpellcheckView";
import { TimingCheckView } from "@/components/modules/TimingCheckView";
import { VoiceReflectionView } from "@/components/modules/VoiceReflectionView";
import { useAppReady } from "@/hooks/useAppReady";
import { getDefaultModuleFromAccessibleIds } from "@/lib/auth/moduleAccess";
import { useLessonStore } from "@/stores/useLessonStore";

const modules = {
  "active-lesson": ActiveLessonView,
  "manual-scanner": ManualScannerView,
  "goal-optimizer": GoalOptimizerView,
  "goal-taxonomy": GoalTaxonomyView,
  "curriculum-rag": CurriculumRagView,
  "minimum-goals": MinimumGoalsView,
  "dialogue-formatter": DialogueFormatterView,
  spellcheck: SpellcheckView,
  "timing-check": TimingCheckView,
  alignment: AlignmentAuditView,
  engagement: EngagementView,
  "full-audit": FullAuditView,
  "voice-reflection": VoiceReflectionView,
};

export function Dashboard({
  userEmail,
  displayName,
  profileImageUrl,
  tier,
}: {
  userEmail: string;
  displayName: string | null;
  profileImageUrl: string | null;
  tier: string;
}) {
  return (
    <DashboardContent
      userEmail={userEmail}
      displayName={displayName}
      profileImageUrl={profileImageUrl}
      tier={tier}
    />
  );
}

function DashboardContent({
  userEmail,
  displayName,
  profileImageUrl,
  tier,
}: {
  userEmail: string;
  displayName: string | null;
  profileImageUrl: string | null;
  tier: string;
}) {
  const ready = useAppReady();
  const { canAccessModule, accessibleModuleIds } = useModuleAccess();
  const activeModule = useLessonStore((state) => state.activeModule);
  const setActiveModule = useLessonStore((state) => state.setActiveModule);
  const ActiveModule = modules[activeModule];

  useEffect(() => {
    if (!canAccessModule(activeModule)) {
      const fallback = getDefaultModuleFromAccessibleIds(
        Array.from(accessibleModuleIds),
      );
      if (fallback) {
        setActiveModule(fallback);
      }
    }
  }, [activeModule, accessibleModuleIds, canAccessModule, setActiveModule]);

  if (!ready) {
    return (
      <LoadingGate loading intent="quick" label="Leerkrachtentools laden…">
        <></>
      </LoadingGate>
    );
  }

  const moduleAllowed = canAccessModule(activeModule);

  return (
    <AppShell
      account={{
        email: userEmail,
        displayName,
        tier,
        profileImageUrl,
      }}
    >
      <PreparationTextSync />
      <ActiveLessonBar userEmail={userEmail} />
      {moduleAllowed ? <ActiveModule /> : <ModuleAccessDeniedCard tier={tier} />}
    </AppShell>
  );
}
