"use client";

import { ActiveLessonBar } from "@/components/layout/ActiveLessonBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { AlignmentAuditView } from "@/components/modules/AlignmentAuditView";
import { CurriculumRagView } from "@/components/modules/CurriculumRagView";
import { DialogueFormatterView } from "@/components/modules/DialogueFormatterView";
import { EngagementView } from "@/components/modules/EngagementView";
import { FullAuditView } from "@/components/modules/FullAuditView";
import { GoalOptimizerView } from "@/components/modules/GoalOptimizerView";
import { ManualScannerView } from "@/components/modules/ManualScannerView";
import { SpellcheckView } from "@/components/modules/SpellcheckView";
import { TimingCheckView } from "@/components/modules/TimingCheckView";
import { VoiceReflectionView } from "@/components/modules/VoiceReflectionView";
import { useLessonStore } from "@/stores/useLessonStore";

const modules = {
  "manual-scanner": ManualScannerView,
  "goal-optimizer": GoalOptimizerView,
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
  marketingOptIn,
}: {
  userEmail: string;
  marketingOptIn: boolean;
}) {
  const activeModule = useLessonStore((state) => state.activeModule);
  const ActiveModule = modules[activeModule];

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <div className="lg:pl-64">
        <ActiveLessonBar
          userEmail={userEmail}
          initialMarketingOptIn={marketingOptIn}
        />
        <main>
          <ActiveModule />
        </main>
      </div>
    </div>
  );
}
