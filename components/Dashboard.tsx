"use client";

import { ActiveLessonBar } from "@/components/layout/ActiveLessonBar";
import { AppShell } from "@/components/layout/AppShell";
import { AppLoadingScreen } from "@/components/shared/AppLoadingScreen";
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
  const ready = useAppReady();
  const activeModule = useLessonStore((state) => state.activeModule);
  const ActiveModule = modules[activeModule];

  if (!ready) {
    return <AppLoadingScreen label="Leerkrachtentools laden…" />;
  }

  return (
    <AppShell
      account={{
        email: userEmail,
        displayName,
        tier,
        profileImageUrl,
      }}
    >
      <ActiveLessonBar userEmail={userEmail} />
      <ActiveModule />
    </AppShell>
  );
}
