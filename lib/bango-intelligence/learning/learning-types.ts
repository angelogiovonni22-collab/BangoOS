import type { LearningConfidence, LearningMetricRecord, LearningSubjectType, LearningTrait } from "./metric-types";

export type LearningLimitations = string[];

export type LearningEngineOutput = {
  subjectType: LearningSubjectType;
  metrics: LearningMetricRecord[];
  traits: LearningTrait[];
  limitations: LearningLimitations;
};

export type LearningSnapshot = {
  metrics: LearningMetricRecord[];
  traits: LearningTrait[];
  generatedAt: string;
  limitations: LearningLimitations;
};

export type LearningBriefingLine = {
  metricId: string;
  confidence: LearningConfidence;
  text: string;
};

export type LearningContextResult = {
  snapshot: LearningSnapshot;
  briefingLines: LearningBriefingLine[];
};

export type StructuredLearningDNA = {
  traits: LearningTrait[];
  evidenceCount: number;
  confidence: LearningConfidence;
  generatedAt: string;
  limitations: string[];
};

export type CompanyLearningDNA = StructuredLearningDNA;
export type ProjectLearningDNA = StructuredLearningDNA;
export type CustomerLearningDNA = StructuredLearningDNA;
