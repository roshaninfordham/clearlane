import { z } from "zod";
import { DataCompletenessSchema, PeriodSchema } from "./common.js";

export const MetricsSchema = z.object({
  route: z.string(),
  period: PeriodSchema,
  segmentsAnalyzed: z.number(),
  priorityBottlenecks: z.number(),
  lowestAvgSpeedMph: z.number().nullable(),
  relevant311Complaints: z.number(),
  visionFindings: z.number(),
  humanReviewRequired: z.boolean(),
  dataCompleteness: DataCompletenessSchema
});

export type Metrics = z.infer<typeof MetricsSchema>;
