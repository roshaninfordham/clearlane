import { z } from "zod";

export const PeriodSchema = z.enum([
  "weekday_am",
  "weekday_pm",
  "midday",
  "evening",
  "weekend",
  "all"
]);

export type Period = z.infer<typeof PeriodSchema>;

export const SourceRefSchema = z.object({
  source: z.string(),
  datasetId: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  query: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
  contentHash: z.string().optional()
});

export type SourceRef = z.infer<typeof SourceRefSchema>;

export const DataCompletenessSchema = z.object({
  mtaSegmentSpeeds: z.enum(["available", "mock", "unavailable"]),
  mtaRealtime: z.enum(["available", "unavailable", "skipped"]),
  nyc311: z.enum(["available", "mock", "unavailable"]),
  visionEvidence: z.enum(["available", "mock", "unavailable", "skipped"])
});

export type DataCompleteness = z.infer<typeof DataCompletenessSchema>;

export function nowIso(): string {
  return new Date().toISOString();
}
