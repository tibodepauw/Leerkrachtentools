export type EducationNetwork = "ZILL" | "OVSG" | "GO";
export type CurriculumNetworkFilter =
  | "ALL"
  | "OPSTAP"
  | "OVSG"
  | "GO_NIEUW"
  | "ZILL"
  | "GO"
  | "KOV"
  | "POV";
export type EducationLevelFilter =
  | "ALL"
  | "KLEUTER"
  | "LAGER"
  | "SECUNDAIR";
export type EducationLevelPreference =
  | "kleuteronderwijs"
  | "lager_onderwijs"
  | "secundair_onderwijs";
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

export type LessonGrade =
  | "peuters"
  | "k1"
  | "k2"
  | "k3"
  | "l1"
  | "l2"
  | "l3"
  | "l4"
  | "l5"
  | "l6"
  | "s1"
  | "s2"
  | "s3"
  | "s7"
  | "custom";

export type SecondaryGradeFilter =
  | "all"
  | "1ste_graad"
  | "2de_graad"
  | "3de_graad"
  | "7de_specialisatie";

export type SecondaryFinalityFilter =
  | "all"
  | "doorstroom"
  | "dubbel"
  | "arbeidsmarkt";

export interface TargetGroupSearchContext {
  grade?: LessonGrade | "";
  ageRange?: string;
  secondaryGrade?: SecondaryGradeFilter;
  secondaryFinality?: SecondaryFinalityFilter;
}

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

export interface LessonPreparationDocument {
  id: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
}

export interface ActiveLesson {
  topic: string;
  learningArea: string;
  component: string;
  targetGroup: string;
  grade: LessonGrade | "";
  ageRange: string;
  displayTargetGroup: string;
  materials: string[];
  rawPublisherGoals: string[];
  goals: LessonGoal[];
  totalMinutes: number;
  educationNetwork: EducationNetwork;
  referenceSchoolYear: string;
  lessonPreparation: string;
  preparationDocument: LessonPreparationDocument | null;
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

export interface LinkedMinimumGoal {
  code: string;
  tekst: string;
  type: string;
  rawCode?: string;
  ijkpuntLabel?: string;
  ijkpuntShort?: string;
}

export interface CurriculumSearchResult {
  code: string;
  discipline: string;
  subdomein: string;
  titel: string;
  toelichting: string;
  leerjaarRoute: string;
  gelinktMinimumdoel: LinkedMinimumGoal | null;
  netwerk: string;
  bronUrl: string;
  snippet?: string;
  sourceUri?: string;
  bronTitel?: string;
  verrijking?: "corpus" | "fragment";
  score?: number;
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
