import { z } from "zod";

export const RecommendationTypeSchema = z.enum([
  "field_verify",
  "review_bus_lane_enforcement",
  "evaluate_loading_zone",
  "coordinate_dot_mta_review",
  "compare_before_after",
  "improve_signage",
  "monitor_corridor"
]);

export const RecommendationSchema = z.object({
  type: RecommendationTypeSchema,
  action: z.string(),
  reason: z.string(),
  evidenceRefs: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  humanReviewNote: z.string()
});

export type Recommendation = z.infer<typeof RecommendationSchema>;
