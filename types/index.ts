export type EducationNetwork = "ZILL" | "OVSG" | "GO";
export type GoalTaxonomy = "MC" | "DAS" | "SPM";
export type ModuleId =
  | "manual-scanner"
  | "goal-optimizer"
  | "curriculum-rag"
  | "dialogue-formatter"
  | "spellcheck"
  | "timing-check"
  | "alignment"
  | "engagement"
  | "full-audit"
  | "voice-reflection";

export interface LessonGoal {
  id: "D1" | "D2" | "D3";
  text: string;
  taxonomy?: GoalTaxonomy;
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
