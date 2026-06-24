import { AuditLedger } from "../audit/ledger.js";
import { Bottleneck, SegmentSpeed } from "../schemas/route.js";

export class SpeedBottleneckAgent {
  constructor(private readonly ledger: AuditLedger) {}

  async run(segments: SegmentSpeed[]): Promise<Bottleneck[]> {
    const bottlenecks = segments
      .filter((segment) => segment.avgSpeedMph === undefined || segment.avgSpeedMph < 9)
      .sort((a, b) => (a.avgSpeedMph ?? 999) - (b.avgSpeedMph ?? 999))
      .slice(0, 3)
      .map((segment) => ({
        segmentId: segment.segmentId,
        ...(segment.fromStop ? { fromStop: segment.fromStop } : {}),
        ...(segment.toStop ? { toStop: segment.toStop } : {}),
        ...(segment.avgSpeedMph !== undefined ? { avgSpeedMph: segment.avgSpeedMph } : {}),
        ...(segment.avgTravelTimeMin !== undefined
          ? { avgTravelTimeMin: segment.avgTravelTimeMin }
          : {}),
        severity: severityForSpeed(segment.avgSpeedMph),
        reason:
          segment.avgSpeedMph === undefined
            ? "Average speed data is missing; this segment requires data review."
            : `Average speed of ${segment.avgSpeedMph.toFixed(1)} mph is below the corridor review threshold.`,
        confidence: segment.avgSpeedMph === undefined ? 0.45 : 0.82
      }));

    await this.ledger.append({
      actor: "SpeedBottleneckAgent",
      action: "rank_slow_segments",
      input_refs: segments.map((segment) => segment.segmentId),
      output_refs: bottlenecks.map((bottleneck) => `bottleneck:${bottleneck.segmentId}`),
      source_refs: segments.flatMap((segment) => segment.sourceRefs),
      claim: `Identified ${bottlenecks.length} priority bottleneck segments from speed data.`,
      confidence: 0.82
    });
    return bottlenecks;
  }
}

function severityForSpeed(avgSpeedMph?: number): Bottleneck["severity"] {
  if (avgSpeedMph === undefined) return "medium";
  if (avgSpeedMph < 5) return "critical";
  if (avgSpeedMph < 7) return "high";
  if (avgSpeedMph < 9) return "medium";
  return "low";
}
