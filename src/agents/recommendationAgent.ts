import { ComplaintHotspot } from "../api/nycOpenDataClient.js";
import { AuditLedger } from "../audit/ledger.js";
import { nearbyComplaints } from "../geo/segmentMatcher.js";
import { Recommendation } from "../schemas/recommendation.js";
import { Bottleneck, SegmentSpeed } from "../schemas/route.js";
import { scoreSegment, PriorityScore } from "../scoring/priorityScore.js";
import { VisionFinding } from "../vision/visionSchemas.js";

export type RecommendationResult = {
  recommendations: Recommendation[];
  priorityScores: Record<string, PriorityScore>;
};

export class RecommendationAgent {
  constructor(private readonly ledger: AuditLedger) {}

  async run(options: {
    bottlenecks: Bottleneck[];
    segments: SegmentSpeed[];
    complaints: ComplaintHotspot[];
    busLaneSegmentIds: string[];
    visionFindings: VisionFinding[];
  }): Promise<RecommendationResult> {
    const priorityScores: Record<string, PriorityScore> = {};
    for (const bottleneck of options.bottlenecks) {
      const segment = options.segments.find((candidate) => candidate.segmentId === bottleneck.segmentId);
      if (!segment) continue;
      priorityScores[bottleneck.segmentId] = scoreSegment({
        segment,
        complaints: nearbyComplaints(segment, options.complaints),
        busLaneOverlap: options.busLaneSegmentIds.includes(segment.segmentId),
        visionFindings: options.visionFindings
      });
    }

    const top = options.bottlenecks[0];
    const topLabel = top ? `${top.fromStop ?? top.segmentId} to ${top.toStop ?? "next stop"}` : "top corridor segment";
    const recommendations: Recommendation[] = [
      {
        type: "field_verify",
        action: `Field-verify ${topLabel} during weekday AM peak.`,
        reason: "The top segment combines low historical speed with nearby curb and traffic complaint signals.",
        evidenceRefs: top ? [`bottleneck:${top.segmentId}`, ...refs(priorityScores[top.segmentId])] : [],
        confidence: 0.82,
        humanReviewNote: "Confirm field conditions before operational action."
      },
      {
        type: "review_bus_lane_enforcement",
        action: "Review bus-lane and camera enforcement eligibility for the priority segment.",
        reason: "Bus-lane context overlaps with at least one slow segment and optional evidence suggests possible blockage.",
        evidenceRefs: [
          ...options.busLaneSegmentIds.map((id) => `bus-lane:${id}`),
          ...options.visionFindings
            .map((finding) => finding.evidencePath)
            .filter((value): value is string => Boolean(value))
        ],
        confidence: 0.74,
        humanReviewNote: "This is not an enforcement conclusion; eligibility must be checked by authorized staff."
      },
      {
        type: "evaluate_loading_zone",
        action: "Evaluate nearby loading-zone or curb-management changes to reduce recurring curb conflicts.",
        reason: "Relevant 311 complaints and optional visual evidence are consistent with curbside activity affecting bus movement.",
        evidenceRefs: options.complaints.map((hotspot) => `311:${hotspot.complaintType}`),
        confidence: 0.71,
        humanReviewNote: "Verify signage, land use, and loading demand before recommending curb changes."
      },
      {
        type: "compare_before_after",
        action: "Re-run ClearLane after any intervention to compare before/after segment speeds.",
        reason: "A repeatable audit ledger and metrics artifact can support transparent intervention review.",
        evidenceRefs: ["metrics.json", "audit-log.ndjson"],
        confidence: 0.86,
        humanReviewNote: "Use comparable dates, days of week, and time periods for before/after review."
      }
    ];

    await this.ledger.append({
      actor: "RecommendationAgent",
      action: "generate_recommendations",
      input_refs: [
        ...options.bottlenecks.map((bottleneck) => `bottleneck:${bottleneck.segmentId}`),
        ...options.complaints.map((hotspot) => `311:${hotspot.complaintType}`)
      ],
      output_refs: recommendations.map((recommendation) => `recommendation:${recommendation.type}`),
      source_refs: options.segments.flatMap((segment) => segment.sourceRefs),
      claim: `Generated ${recommendations.length} decision-support recommendations that require human review.`,
      confidence: 0.78
    });

    return { recommendations, priorityScores };
  }
}

function refs(score?: PriorityScore): string[] {
  return score?.evidenceRefs ?? [];
}
