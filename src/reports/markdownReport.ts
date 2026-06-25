import { AuditManifest } from "../audit/schemas.js";
import { routeHealthMermaid } from "./mermaid.js";
import { RouteHealth } from "./reportSchemas.js";

export function markdownReport(routeHealth: RouteHealth, manifest?: AuditManifest): string {
  const metrics = routeHealth.metrics;
  const bottlenecks = routeHealth.bottlenecks;
  const lowest =
    metrics.lowestAvgSpeedMph === null ? "Unavailable" : `${metrics.lowestAvgSpeedMph.toFixed(1)} mph`;

  return `# ClearLane Bus Reliability Audit

Route: ${routeHealth.route}
Borough: ${routeHealth.borough ?? "Not specified"}
Period: ${labelPeriod(routeHealth.period)}
Generated: ${routeHealth.generatedAt}

## Executive Summary

ClearLane identified ${metrics.priorityBottlenecks} priority bottleneck${metrics.priorityBottlenecks === 1 ? "" : "s"}. The highest-priority segment shows low historical speed, nearby complaints related to curb or traffic issues, and optional visual evidence consistent with possible lane blockage where available. Findings require human review before operational, enforcement, or policy action.

${routeHealth.disclaimer}

## Key Metrics

| Metric | Value |
|---|---:|
| Segments analyzed | ${metrics.segmentsAnalyzed} |
| Priority bottlenecks | ${metrics.priorityBottlenecks} |
| Lowest observed avg speed | ${lowest} |
| Relevant 311 complaints nearby | ${metrics.relevant311Complaints} |
| Vision evidence findings | ${metrics.visionFindings} |

## Corridor Signal Map

\`\`\`mermaid
${routeHealthMermaid(routeHealth).trim()}
\`\`\`

## Top Bottlenecks

${bottlenecks
  .map((bottleneck, index) => {
    const score = routeHealth.priorityScores[bottleneck.segmentId];
    return `### ${index + 1}. ${bottleneck.fromStop ?? bottleneck.segmentId} to ${bottleneck.toStop ?? "next stop"}

- Segment ID: ${bottleneck.segmentId}
- Severity: ${bottleneck.severity}
- Avg speed: ${bottleneck.avgSpeedMph?.toFixed(1) ?? "Unavailable"} mph
- Avg travel time: ${bottleneck.avgTravelTimeMin?.toFixed(1) ?? "Unavailable"} min
- Priority score: ${score?.priorityScore ?? "Unavailable"}
- Confidence: ${score?.confidence ?? bottleneck.confidence}
- Reason: ${bottleneck.reason}
- Evidence refs: ${score?.evidenceRefs.join(", ") ?? `segment:${bottleneck.segmentId}`}`;
  })
  .join("\n\n")}

## Evidence

### Data Sources

${routeHealth.sourceRefs
  .map(
    (source) =>
      `- ${source.source}${source.datasetId ? ` (${source.datasetId})` : ""}: ${source.description ?? "source record"}`
  )
  .join("\n")}

### Real-Time MTA Bus Time

${
  routeHealth.realtimeSnapshot?.sourceMode === "available"
    ? `- Vehicle records fetched: ${routeHealth.realtimeSnapshot.vehicleCount}
- Snapshot time: ${routeHealth.realtimeSnapshot.fetchedAt}`
    : `- Status: ${routeHealth.dataCompleteness.mtaRealtime}`
}

### Bus Lane Context

${
  routeHealth.busLaneContexts?.length
    ? routeHealth.busLaneContexts
        .slice(0, 10)
        .map((lane) => `- ${lane.label}${lane.borough ? ` (${lane.borough})` : ""}`)
        .join("\n")
    : "- No bus-lane context records were attached."
}

### 311 Complaint Hotspots

${routeHealth.complaintHotspots
  .map(
    (hotspot) =>
      `- ${hotspot.complaintType}: ${hotspot.count} complaint${hotspot.count === 1 ? "" : "s"}${hotspot.latitude !== undefined && hotspot.longitude !== undefined ? ` near ${hotspot.latitude.toFixed(4)}, ${hotspot.longitude.toFixed(4)}` : ""}`
  )
  .join("\n")}

### Optional Vision Evidence

${
  routeHealth.visionFindings.length
    ? routeHealth.visionFindings
        .map(
          (finding) =>
            `- ${finding.eventType} (${Math.round(finding.confidence * 100)}% confidence): ${finding.description} Evidence: ${finding.evidencePath ?? "not saved"}`
        )
        .join("\n")
    : "- No optional image or video evidence findings were included."
}

## Recommendations

${routeHealth.recommendations
  .map(
    (recommendation, index) => `### ${index + 1}. ${recommendation.action}

- Type: ${recommendation.type}
- Reason: ${recommendation.reason}
- Confidence: ${recommendation.confidence}
- Evidence references: ${recommendation.evidenceRefs.join(", ")}
- Human review: ${recommendation.humanReviewNote}`
  )
  .join("\n\n")}

## Data Completeness

| Source | Status |
|---|---|
| MTA segment speeds | ${routeHealth.dataCompleteness.mtaSegmentSpeeds} |
| MTA real-time Bus Time | ${routeHealth.dataCompleteness.mtaRealtime} |
| NYC 311 | ${routeHealth.dataCompleteness.nyc311} |
| Vision evidence | ${routeHealth.dataCompleteness.visionEvidence} |

## Human Review Checklist

- Verify bus lane geometry.
- Confirm signage and curb regulation.
- Confirm whether observed blockage is recurring.
- Compare before/after speeds after any intervention.

## Audit Appendix

- Ledger: ${routeHealth.audit.ledgerPath}
- Final ledger hash: ${manifest?.final_event_hash ?? routeHealth.audit.finalEventHash ?? "pending"}
- Ledger SHA-256: ${manifest?.ledger_sha256 ?? "pending"}
- Artifacts: ${(manifest?.artifacts ?? []).map((artifact) => artifact.path).join(", ") || "pending"}
`;
}

function labelPeriod(period: string): string {
  return period
    .split("_")
    .map((part) => (part === "am" || part === "pm" ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}
