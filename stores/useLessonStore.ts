"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  buildGoalsFromPublisher,
  createEmptyGoals,
  nextGoalId,
  trimTrailingEmptyGoals,
  MAX_LESSON_GOALS,
} from "@/lib/goals/lessonGoals";
import { deleteLessonDocument } from "@/lib/documents/documentStorage";
import {
  migrateLessonTargetGroup,
  resolveTargetGroupFields,
} from "@/lib/lesson/targetGroup";
import type {
  ActiveLesson,
  EducationNetwork,
  LessonGoal,
  LessonGrade,
  ManualExtraction,
  ModuleId,
} from "@/types";

const initialLesson: ActiveLesson = {
  topic: "",
  learningArea: "",
  component: "",
  targetGroup: "",
  grade: "",
  ageRange: "",
  displayTargetGroup: "",
  materials: [],
  rawPublisherGoals: [],
  goals: createEmptyGoals(),
  totalMinutes: 50,
  educationNetwork: "ZILL",
  referenceSchoolYear: "",
  lessonPreparation: "",
  preparationDocument: null,
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
  pinnedModules: ModuleId[];
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setActiveModule: (module: ModuleId) => void;
  togglePinnedModule: (module: ModuleId) => void;
  setField: <K extends keyof ActiveLesson>(
    key: K,
    value: ActiveLesson[K],
  ) => void;
  setTargetGroupSelection: (value: {
    grade: LessonGrade | "";
    customLabel?: string;
    customAgeRange?: string;
  }) => void;
  setGoal: (index: number, goal: Partial<LessonGoal>) => void;
  addGoalSlot: () => LessonGoal["id"] | null;
  replaceGoalText: (index: number, text: string) => void;
  setActiveGoal: (text: string, taxonomy?: LessonGoal["taxonomy"]) => void;
  syncFromExtraction: (data: ManualExtraction) => void;
  syncPreparation: (text: string) => void;
  setPreparationDocument: (
    document: ActiveLesson["preparationDocument"],
    previousDocumentId?: string,
  ) => void;
  setNetwork: (network: EducationNetwork) => void;
  clearSession: () => void;
}

export const useLessonStore = create<LessonStore>()(
  persist(
    (set) => ({
      lesson: initialLesson,
      activeModule: "manual-scanner",
      pinnedModules: [],
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setActiveModule: (activeModule) => set({ activeModule }),
      togglePinnedModule: (moduleId) =>
        set((state) => ({
          pinnedModules: state.pinnedModules.includes(moduleId)
            ? state.pinnedModules.filter((id) => id !== moduleId)
            : [...state.pinnedModules, moduleId],
        })),
      setField: (key, value) =>
        set((state) => ({ lesson: { ...state.lesson, [key]: value } })),
      setTargetGroupSelection: ({ grade, customLabel, customAgeRange }) =>
        set((state) => ({
          lesson: {
            ...state.lesson,
            ...resolveTargetGroupFields({
              grade,
              customLabel,
              customAgeRange,
            }),
          },
        })),
      setGoal: (index, patch) =>
        set((state) => {
          let goals = state.lesson.goals.map((goal, goalIndex) =>
            goalIndex === index ? { ...goal, ...patch } : goal,
          );

          if (patch.text !== undefined && !patch.text.trim()) {
            goals = goals.filter((_, goalIndex) => goalIndex !== index);
          } else {
            goals = trimTrailingEmptyGoals(goals);
          }

          return {
            lesson: {
              ...state.lesson,
              goals,
            },
          };
        }),
      addGoalSlot: () => {
        let createdId: LessonGoal["id"] | null = null;

        set((state) => {
          const trimmed = trimTrailingEmptyGoals(state.lesson.goals);
          if (trimmed.length >= MAX_LESSON_GOALS) {
            return state;
          }

          createdId = nextGoalId(trimmed);
          return {
            lesson: {
              ...state.lesson,
              goals: [...trimmed, { id: createdId, text: "" }],
            },
          };
        });

        return createdId;
      },
      replaceGoalText: (index, text) =>
        set((state) => {
          const previousText = state.lesson.goals[index]?.text.trim() ?? "";
          const lessonPreparation =
            previousText && state.lesson.lessonPreparation.includes(previousText)
              ? state.lesson.lessonPreparation.replaceAll(previousText, text)
              : state.lesson.lessonPreparation;

          return {
            lesson: {
              ...state.lesson,
              lessonPreparation,
              goals: state.lesson.goals.map((goal, goalIndex) =>
                goalIndex === index ? { ...goal, text } : goal,
              ),
            },
          };
        }),
      setActiveGoal: (text, taxonomy) =>
        set((state) => {
          const trimmed = trimTrailingEmptyGoals(state.lesson.goals);
          const newGoal: LessonGoal = {
            id: nextGoalId(trimmed),
            text,
            taxonomy,
          };

          return {
            lesson: {
              ...state.lesson,
              goals: [...trimmed, newGoal],
            },
          };
        }),
      syncFromExtraction: (data) =>
        set((state) => {
          const publisherGoals = data.rawPublisherGoals.filter((goal) =>
            goal.trim(),
          );
          const targetGroupFields = migrateLessonTargetGroup({
            targetGroup: data.targetGroup,
          });
          return {
            lesson: {
              ...state.lesson,
              topic: data.topic,
              learningArea: data.learningArea,
              component: data.component,
              ...targetGroupFields,
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
      setPreparationDocument: (preparationDocument, previousDocumentId) => {
        if (previousDocumentId && previousDocumentId !== preparationDocument?.id) {
          void deleteLessonDocument(previousDocumentId).catch(() => undefined);
        }

        set((state) => ({
          lesson: { ...state.lesson, preparationDocument },
        }));
      },
      setNetwork: (educationNetwork) =>
        set((state) => ({
          lesson: { ...state.lesson, educationNetwork },
        })),
      clearSession: () => {
        const previousDocumentId =
          useLessonStore.getState().lesson.preparationDocument?.id;
        if (previousDocumentId) {
          void deleteLessonDocument(previousDocumentId).catch(() => undefined);
        }
        set({ lesson: initialLesson });
      },
    }),
    {
      name: "leerkrachtentools-active-lesson",
      partialize: (state) => ({
        lesson: state.lesson,
        activeModule: state.activeModule,
        pinnedModules: state.pinnedModules,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<typeof currentState> | undefined;
        const mergedLesson = {
          ...currentState.lesson,
          ...persisted?.lesson,
          preparationDocument:
            persisted?.lesson?.preparationDocument ?? null,
        };

        return {
          ...currentState,
          ...persisted,
          lesson: {
            ...mergedLesson,
            ...migrateLessonTargetGroup(mergedLesson),
          },
          pinnedModules: persisted?.pinnedModules ?? currentState.pinnedModules,
        };
      },
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
