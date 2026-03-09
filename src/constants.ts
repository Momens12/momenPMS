export const PROJECT_STAGES = [
  "Analysis Session",
  "BRD Submission",
  "BRD Review & Sign-Off",
  "Pre Development Session",
  "Development",
  "Demo",
  "UAT",
  "Deployment",
  "Go live"
] as const;

export type ProjectStage = typeof PROJECT_STAGES[number];
