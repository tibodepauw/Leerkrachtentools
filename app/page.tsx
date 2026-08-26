"use client";

import { ActiveLessonBar } from "@/components/layout/ActiveLessonBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { ModulePlaceholder } from "@/components/modules/ModulePlaceholder";
import { useLessonStore } from "@/stores/useLessonStore";

const moduleCopy = {
  "manual-scanner": ["Handleiding Scanner", "Extraheer lesgegevens en ruwe uitgeverijdoelen uit een handleiding."],
  "goal-optimizer": ["Doelverbeteraar & taxonomie", "Maak doelen enkelvoudig, waarneembaar en meetbaar."],
  "curriculum-rag": ["Curriculum RAG", "Koppel een doel aan officiële minimum- en leerplandoelen."],
  "dialogue-formatter": ["Thomas More stijl", "Zet ruwe lesnotities om naar correcte Lk/Lln-dialogen."],
  spellcheck: ["Didactische taalfoutencheck", "Controleer taal, instructiestijl en onderwijsterminologie."],
  "timing-check": ["Timing & tijdscontrole", "Controleer de fasetijden en optimaliseer de verdeling."],
  alignment: ["Doel-activiteit alignering", "Controleer instructie, oefening en evaluatie per doel."],
  engagement: ["Betrokkenheidsfactoren", "Analyseer de zes betrokkenheidsverhogende factoren."],
  "full-audit": ["Totale lesvoorbereiding audit", "Voer een complete didactische kwaliteitscontrole uit."],
  "voice-reflection": ["Voice-to-reflectie", "Vul Pagina 5 aan via audio, tekst en gerichte vervolgvragen."],
} as const;

export default function Home() {
  const activeModule = useLessonStore((state) => state.activeModule);
  const [title, description] = moduleCopy[activeModule];

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <div className="lg:pl-64">
        <ActiveLessonBar />
        <main>
          <ModulePlaceholder title={title} description={description} />
        </main>
      </div>
    </div>
  );
}
