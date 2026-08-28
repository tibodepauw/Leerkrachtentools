export type EducationNetwork = "ZILL" | "OVSG" | "GO";
export type GoalTaxonomy = "MC" | "DAS" | "SPM";
export type ModuleId =
  | "active-lesson"
  | "manual-scanner"
  | "goal-optimizer"
  | "goal-taxonomy"
  | "curriculum-rag"
  | "minimum-goals"
  | "dialogue-formatter"
  | "spellcheck"
  | "timing-check"
  | "alignment"
  | "engagement"
  | "full-audit"
  | "voice-reflection";

export type LessonGoalId =
  | "D1"
  | "D2"
  | "D3"
  | "D4"
  | "D5"
  | "D6"
  | "D7"
  | "D8"
  | "D9"
  | "D10"
  | "D11"
  | "D12";

export interface LessonGoal {
  id: LessonGoalId;
  text: string;
  taxonomy?: GoalTaxonomy;
}

export interface LessonExportPayload {
  topic: string;
  learningArea: string;
  component: string;
  targetGroup: string;
  materials: string[];
  goals: LessonGoal[];
  totalMinutes: number;
  educationNetwork: EducationNetwork;
  lessonPreparation: string;
}

export interface LessonPhase {
  name: "Instap" | "Instructie" | "Verwerking" | "Afronding";
  text: string;
}

export interface ActiveLesson {
  topic: string;
  learningArea: string;
  component: string;
  targetGroup: string;
  materials: string[];
  rawPublisherGoals: string[];
  goals: LessonGoal[];
  totalMinutes: number;
  educationNetwork: EducationNetwork;
  referenceSchoolYear: string;
  lessonPreparation: string;
  phases: LessonPhase[];
  engagementFactors: string[];
}

export interface ManualExtraction {
  learningArea: string;
  component: string;
  topic: string;
  targetGroup: string;
  materials: string[];
  rawPublisherGoals: string[];
}

export interface CurriculumGoal {
  id: string;
  source: "minimumdoel" | "leerplandoel";
  network: EducationNetwork | "VLAANDEREN";
  code: string;
  text: string;
  discipline: string;
  gradeLevel: string;
  framework: string;
  domain: string;
  subject: string;
  schoolYears: string[];
  status: "active" | "future" | "archive";
  sourceUrl: string;
  retrievedAt: string;
  version: string;
  approvalStatus: string;
  keywords: string[];
}

export interface ReflectionDraft {
  goals: Array<{
    id: string;
    reach: "meerderheid" | "minderheid" | "onbekend";
    evidence: string;
  }>;
  engagement: Array<{ factor: string; evaluation: string }>;
  teacherIdentity: string;
  followUpQuestions: string[];
}
