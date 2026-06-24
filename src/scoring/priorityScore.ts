import { ComplaintHotspot } from "../api/nycOpenDataClient.js";
import { VisionFinding } from "../vision/visionSchemas.js";
import { SegmentSpeed } from "../schemas/route.js";
import { complaintScore } from "./hotspotScore.js";
import { reliabilityConfidence, speedScore } from "./reliabilityScore.js";

export type PriorityScore = {
  priorityScore: number;
  confidence: number;
  explanation: string;
  evidenceRefs: string[];
};

export function scoreSegment(options: {
  segment: SegmentSpeed;
  complaints: ComplaintHotspot[];
  busLaneOverlap: boolean;
  visionFindings: VisionFinding[];
}): PriorityScore {
  const speed = speedScore(options.segment.avgSpeedMph);
  const complaints = complaintScore(options.complaints);
  const busLane = options.busLaneOverlap ? 85 : 20;
  const vision = options.visionFindings.some((finding) => finding.eventType !== "unclear") ? 75 : 15;
  const completeness = options.segment.avgSpeedMph !== undefined ? 85 : 35;
  const priorityScore =
    speed * 0.4 + complaints * 0.2 + busLane * 0.15 + vision * 0.15 + completeness * 0.1;
  const confidence = Math.min(
    0.95,
    reliabilityConfidence(options.segment.sampleSize, Boolean(options.segment.geometry)) +
      (options.complaints.length ? 0.08 : 0) +
      (options.visionFindings.length ? 0.05 : 0)
  );
  return {
    priorityScore: Number(priorityScore.toFixed(1)),
    confidence: Number(confidence.toFixed(2)),
    explanation: `Priority reflects speed (${speed.toFixed(0)}), nearby relevant 311 complaints (${complaints.toFixed(0)}), bus-lane context (${busLane}), and optional vision evidence (${vision}).`,
    evidenceRefs: [
      `segment:${options.segment.segmentId}`,
      ...options.complaints.map((hotspot) => `311:${hotspot.complaintType}`),
      ...options.visionFindings
        .map((finding) => finding.evidencePath)
        .filter((value): value is string => Boolean(value))
    ]
  };
}
