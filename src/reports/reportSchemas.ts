import { ComplaintHotspot } from "../api/nycOpenDataClient.js";
import { DataCompleteness, Period, SourceRef } from "../schemas/common.js";
import { Metrics } from "../schemas/metrics.js";
import { Recommendation } from "../schemas/recommendation.js";
import { Bottleneck, RouteContext, SegmentSpeed } from "../schemas/route.js";
import { PriorityScore } from "../scoring/priorityScore.js";
import { VisionFinding } from "../vision/visionSchemas.js";

export type RouteHealth = {
  route: string;
  borough?: string;
  period: Period;
  generatedAt: string;
  segments: SegmentSpeed[];
  bottlenecks: Bottleneck[];
  routeContext: RouteContext;
  complaintHotspots: ComplaintHotspot[];
  visionFindings: VisionFinding[];
  recommendations: Recommendation[];
  priorityScores: Record<string, PriorityScore>;
  metrics: Metrics;
  sourceRefs: SourceRef[];
  audit: {
    ledgerPath: string;
    finalEventHash: string | null;
  };
  disclaimer: string;
  dataCompleteness: DataCompleteness;
};
