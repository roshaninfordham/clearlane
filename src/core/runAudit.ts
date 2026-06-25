import path from "node:path";
import { ComplaintHotspotAgent } from "../agents/complaintHotspotAgent.js";
import { RecommendationAgent } from "../agents/recommendationAgent.js";
import { ReportAgent } from "../agents/reportAgent.js";
import { RouteDataAgent } from "../agents/routeDataAgent.js";
import { SpeedBottleneckAgent } from "../agents/speedBottleneckAgent.js";
import { StreetContextAgent } from "../agents/streetContextAgent.js";
import { VisionEvidenceAgent } from "../agents/visionEvidenceAgent.js";
import { MtaBusTimeClient } from "../api/mtaBusTimeClient.js";
import { AuditLedger } from "../audit/ledger.js";
import { verifyLedgerFile } from "../audit/verify.js";
import { ArtifactPaths } from "../schemas/artifacts.js";
import { DataCompleteness, nowIso, Period } from "../schemas/common.js";
import { Metrics } from "../schemas/metrics.js";
import { RouteHealth } from "../reports/reportSchemas.js";
import { CredentialManager } from "../credentials/credentialManager.js";
import { ClearLaneConfig, loadConfig } from "./config.js";
import { createLogger, Logger } from "./logger.js";
import { ensureDir } from "./paths.js";

export type AuditOptions = {
  route: string;
  borough?: string;
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  outDir: string;
  evidenceDir?: string;
  mock: boolean;
  format?: "md" | "pdf" | "json" | "all";
  verbose?: boolean;
  config?: ClearLaneConfig;
};

export type AuditRunResult = {
  summary: string;
  artifacts: ArtifactPaths;
  topFindings: string[];
  routeHealth: RouteHealth;
  humanReviewRequired: true;
};

export async function runAudit(options: AuditOptions): Promise<AuditRunResult> {
  const logger: Logger = createLogger(Boolean(options.verbose));
  await new CredentialManager().applyToProcessEnv();
  const config = options.config ?? (await loadConfig());
  const outDir = path.resolve(options.outDir);
  const evidenceDir = path.resolve(options.evidenceDir ?? config.evidenceDir);
  await ensureDir(outDir);
  await ensureDir(path.join(outDir, "evidence"));

  const ledger = await AuditLedger.open(path.join(outDir, config.audit.ledgerFile));
  await ledger.append({
    actor: "ClearLane",
    action: "start_audit",
    input_refs: [options.route, options.borough ?? "borough_unspecified", options.period],
    output_refs: [outDir],
    source_refs: [],
    claim: `Started ClearLane audit for route ${options.route}.`,
    confidence: 1,
    metadata: { mock: options.mock, dateFrom: options.dateFrom, dateTo: options.dateTo }
  });

  const routeData = await new RouteDataAgent(config, ledger, logger).run({
    route: options.route,
    ...(options.borough ? { borough: options.borough } : {}),
    period: options.period,
    mock: options.mock
  });
  const bottlenecks = await new SpeedBottleneckAgent(ledger).run(routeData.segments);
  const realtimeSnapshot = await new MtaBusTimeClient(
    options.mock ? undefined : process.env[config.dataSources.mtaBusTime.apiKeyEnv]
  ).getVehicleSnapshot(options.route);
  await ledger.append({
    actor: "RouteDataAgent",
    action: "fetch_mta_realtime_vehicle_snapshot",
    input_refs: [options.route],
    output_refs: [`vehicles:${realtimeSnapshot.vehicleCount}`],
    source_refs: realtimeSnapshot.sourceRefs,
    claim:
      realtimeSnapshot.sourceMode === "available"
        ? `Fetched ${realtimeSnapshot.vehicleCount} real-time MTA Bus Time vehicle records.`
        : "MTA Bus Time real-time vehicle snapshot was unavailable or skipped.",
    confidence: realtimeSnapshot.sourceMode === "available" ? 0.72 : 0.4,
    metadata: {
      sourceMode: realtimeSnapshot.sourceMode,
      error: realtimeSnapshot.error
    }
  });
  const streetContext = await new StreetContextAgent(config, ledger, logger).run({
    route: options.route,
    ...(options.borough ? { borough: options.borough } : {}),
    segments: routeData.segments,
    mock: options.mock
  });
  const complaints = await new ComplaintHotspotAgent(config, ledger, logger).run({
    ...(options.borough ? { borough: options.borough } : {}),
    ...(options.dateFrom ? { dateFrom: options.dateFrom } : {}),
    ...(options.dateTo ? { dateTo: options.dateTo } : {}),
    mock: options.mock
  });
  const vision = await new VisionEvidenceAgent(config, ledger).run({
    evidenceDir,
    outDir,
    mock: options.mock
  });
  const recommendationResult = await new RecommendationAgent(ledger).run({
    bottlenecks,
    segments: routeData.segments,
    complaints: complaints.hotspots,
    busLaneSegmentIds: streetContext.busLaneSegmentIds,
    visionFindings: vision.findings
  });

  const dataCompleteness: DataCompleteness = {
    mtaSegmentSpeeds: routeData.sourceMode,
    mtaRealtime:
      realtimeSnapshot.sourceMode === "available"
        ? "available"
        : realtimeSnapshot.sourceMode === "skipped"
          ? "skipped"
          : "unavailable",
    nyc311: complaints.sourceMode,
    visionEvidence: vision.sourceMode
  };
  const speeds = routeData.segments
    .map((segment) => segment.avgSpeedMph)
    .filter((value): value is number => value !== undefined);
  const metrics: Metrics = {
    route: options.route,
    period: options.period,
    segmentsAnalyzed: routeData.segments.length,
    priorityBottlenecks: bottlenecks.length,
    lowestAvgSpeedMph: speeds.length ? Number(Math.min(...speeds).toFixed(1)) : null,
    relevant311Complaints: complaints.hotspots.reduce((sum, hotspot) => sum + hotspot.count, 0),
    visionFindings: vision.findings.length,
    humanReviewRequired: true,
    dataCompleteness
  };

  const routeHealth: RouteHealth = {
    route: options.route,
    ...(options.borough ? { borough: options.borough } : {}),
    period: options.period,
    generatedAt: nowIso(),
    segments: routeData.segments,
    bottlenecks,
    routeContext: streetContext.routeContext,
    busLaneContexts: streetContext.busLaneContexts,
    complaintHotspots: complaints.hotspots,
    realtimeSnapshot,
    visionFindings: vision.findings,
    recommendations: recommendationResult.recommendations,
    priorityScores: recommendationResult.priorityScores,
    metrics,
    sourceRefs: [
      ...routeData.sourceRefs,
      ...streetContext.routeContext.sourceRefs,
      ...realtimeSnapshot.sourceRefs,
      {
        source: complaints.sourceMode === "mock" ? "mock_311_hotspots" : "nyc_open_data_311",
        datasetId: config.datasets.nyc311,
        timestamp: nowIso()
      },
      ...(vision.findings.length
        ? [
            {
              source: vision.sourceMode === "mock" ? "mock_vision_findings" : "openai_responses_api",
              timestamp: nowIso()
            }
          ]
        : [])
    ],
    audit: {
      ledgerPath: path.join(outDir, config.audit.ledgerFile),
      finalEventHash: ledger.finalEventHash
    },
    disclaimer:
      "ClearLane is a decision-support tool. Findings are based on available data and optional visual evidence. They require human review before operational, enforcement, or policy action.",
    dataCompleteness
  };

  const reportResult = await new ReportAgent(ledger).writeArtifacts({
    outDir,
    routeHealth,
    formats: options.format ?? "all"
  });
  const verification = await verifyLedgerFile(reportResult.artifacts.auditLog);
  if (!verification.ok) {
    logger.warn(`Ledger verification reported issues: ${verification.errors.join("; ")}`);
  }

  const topFindings = bottlenecks.map((bottleneck) => {
    const label = `${bottleneck.fromStop ?? bottleneck.segmentId} to ${bottleneck.toStop ?? "next stop"}`;
    return `${label}: ${bottleneck.avgSpeedMph?.toFixed(1) ?? "n/a"} mph (${bottleneck.severity})`;
  });
  return {
    summary: `ClearLane identified ${bottlenecks.length} priority bottleneck(s) for ${options.route}; report written to ${reportResult.artifacts.reportMd}.`,
    artifacts: reportResult.artifacts,
    topFindings,
    routeHealth,
    humanReviewRequired: true
  };
}
