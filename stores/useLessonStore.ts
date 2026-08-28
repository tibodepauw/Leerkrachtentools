"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildGoalsFromPublisher, createEmptyGoals } from "@/lib/goals/lessonGoals";
import type {
  ActiveLesson,
  EducationNetwork,
  LessonGoal,
  ManualExtraction,
  ModuleId,
} from "@/types";

const initialLesson: ActiveLesson = {
  topic: "",
  learningArea: "",
  component: "",
  targetGroup: "",
  materials: [],
  rawPublisherGoals: [],
  goals: createEmptyGoals(),
  totalMinutes: 50,
  educationNetwork: "ZILL",
  referenceSchoolYear: "",
  lessonPreparation: "",
  phases: [
    { name: "Instap", text: "" },
    { name: "Instructie", text: "" },
    { name: "Verwerking", text: "" },
    { name: "Afronding", text: "" },
  ],
  engagementFactors: [],
};

interface LessonStore {
  lesson: ActiveLesson;
  activeModule: ModuleId;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setActiveModule: (module: ModuleId) => void;
  setField: <K extends keyof ActiveLesson>(
    key: K,
    value: ActiveLesson[K],
  ) => void;
  setGoal: (index: number, goal: Partial<LessonGoal>) => void;
  setActiveGoal: (text: string, taxonomy?: LessonGoal["taxonomy"]) => void;
  syncFromExtraction: (data: ManualExtraction) => void;
  syncPreparation: (text: string) => void;
  setNetwork: (network: EducationNetwork) => void;
  clearSession: () => void;
}

export const useLessonStore = create<LessonStore>()(
  persist(
    (set) => ({
      lesson: initialLesson,
      activeModule: "manual-scanner",
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setActiveModule: (activeModule) => set({ activeModule }),
      setField: (key, value) =>
        set((state) => ({ lesson: { ...state.lesson, [key]: value } })),
      setGoal: (index, patch) =>
        set((state) => ({
          lesson: {
            ...state.lesson,
            goals: state.lesson.goals.map((goal, goalIndex) =>
              goalIndex === index ? { ...goal, ...patch } : goal,
            ),
          },
        })),
      setActiveGoal: (text, taxonomy) =>
        set((state) => {
          const firstEmpty = state.lesson.goals.findIndex(
            (goal) => !goal.text.trim(),
          );
          const index = firstEmpty === -1 ? 0 : firstEmpty;
          return {
            lesson: {
              ...state.lesson,
              goals: state.lesson.goals.map((goal, goalIndex) =>
                goalIndex === index ? { ...goal, text, taxonomy } : goal,
              ),
            },
          };
        }),
      syncFromExtraction: (data) =>
        set((state) => {
          const publisherGoals = data.rawPublisherGoals.filter((goal) =>
            goal.trim(),
          );
          return {
            lesson: {
              ...state.lesson,
              topic: data.topic,
              learningArea: data.learningArea,
              component: data.component,
              targetGroup: data.targetGroup,
              materials: data.materials,
              rawPublisherGoals: publisherGoals,
              goals: buildGoalsFromPublisher(
                publisherGoals,
                state.lesson.goals,
              ),
            },
          };
        }),
      syncPreparation: (lessonPreparation) =>
        set((state) => ({
          lesson: { ...state.lesson, lessonPreparation },
        })),
      setNetwork: (educationNetwork) =>
        set((state) => ({
          lesson: { ...state.lesson, educationNetwork },
        })),
      clearSession: () => set({ lesson: initialLesson }),
    }),
    {
      name: "leerkrachtentools-active-lesson",
      partialize: (state) => ({
        lesson: state.lesson,
        activeModule: state.activeModule,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
