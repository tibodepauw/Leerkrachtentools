"use client";

import { ActiveLessonBar } from "@/components/layout/ActiveLessonBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppLoadingScreen } from "@/components/shared/AppLoadingScreen";
import { AlignmentAuditView } from "@/components/modules/AlignmentAuditView";
import { CurriculumRagView } from "@/components/modules/CurriculumRagView";
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
  "manual-scanner": ManualScannerView,
  "goal-optimizer": GoalOptimizerView,
  "goal-taxonomy": GoalTaxonomyView,
  "curriculum-rag": CurriculumRagView,
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
  tier,
}: {
  userEmail: string;
  displayName: string | null;
  tier: string;
}) {
  const ready = useAppReady();
  const activeModule = useLessonStore((state) => state.activeModule);
  const ActiveModule = modules[activeModule];

  if (!ready) {
    return <AppLoadingScreen label="Leerkrachtentools laden…" />;
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar
        account={{
          email: userEmail,
          displayName,
          tier,
        }}
      />
      <div className="lg:pl-64">
        <ActiveLessonBar userEmail={userEmail} />
        <main>
          <ActiveModule />
        </main>
      </div>
    </div>
  );
}
