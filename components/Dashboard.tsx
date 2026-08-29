"use client";

import { useEffect } from "react";
import { ActiveLessonBar } from "@/components/layout/ActiveLessonBar";
import { AppShell } from "@/components/layout/AppShell";
import { ModuleAccessProvider } from "@/components/auth/ModuleAccessProvider";
import { UserStorageScope } from "@/components/auth/UserStorageScope";
import { AppLoadingScreen } from "@/components/shared/AppLoadingScreen";
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
import {
  getDefaultModuleForTier,
  hasModuleAccess,
} from "@/lib/auth/moduleAccess";
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
  userId,
  userEmail,
  displayName,
  profileImageUrl,
  tier,
}: {
  userId: string;
  userEmail: string;
  displayName: string | null;
  profileImageUrl: string | null;
  tier: string;
}) {
  return (
    <UserStorageScope userId={userId}>
      <DashboardContent
        userEmail={userEmail}
        displayName={displayName}
        profileImageUrl={profileImageUrl}
        tier={tier}
      />
    </UserStorageScope>
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
  const activeModule = useLessonStore((state) => state.activeModule);
  const setActiveModule = useLessonStore((state) => state.setActiveModule);
  const ActiveModule = modules[activeModule];

  useEffect(() => {
    if (!hasModuleAccess(tier, activeModule)) {
      const fallback = getDefaultModuleForTier(tier);
      if (fallback) {
        setActiveModule(fallback);
      }
    }
  }, [tier, activeModule, setActiveModule]);

  if (!ready) {
    return <AppLoadingScreen label="Leerkrachtentools laden…" />;
  }

  const moduleAllowed = hasModuleAccess(tier, activeModule);

  return (
    <ModuleAccessProvider tier={tier}>
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
    </ModuleAccessProvider>
  );
}
