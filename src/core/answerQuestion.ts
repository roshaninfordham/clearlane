import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuditLedger } from "../audit/ledger.js";
import { verifyLedgerFile } from "../audit/verify.js";
import { isEnforcementQuestion, questionMermaid } from "../reports/mermaid.js";
import { writeQuestionPdfReport } from "../reports/questionPdfReport.js";
import { RouteHealth } from "../reports/reportSchemas.js";
import { nowIso, Period, PeriodSchema } from "../schemas/common.js";
import { liveDataReady, CredentialManager } from "../credentials/credentialManager.js";
import { runAudit } from "./runAudit.js";

export type AnswerQuestionOptions = {
  question: string;
  route?: string;
  borough?: string;
  period?: Period;
  dateFrom?: string;
  dateTo?: string;
  outDir: string;
  evidenceDir?: string;
  mock: boolean;
  refresh?: boolean;
};

export type QuestionAnswerResult =
  | {
      status: "needs_configuration";
      summary: string;
      missing: string[];
      optionalMissing: string[];
      nextStep: string;
    }
  | {
      status: "complete";
      pitch: string;
      summary: string;
      answer: string;
      keyFindings: AnswerFinding[];
      actionPoints: AnswerAction[];
      mermaid: string;
      dataUsed: Array<{
        source: string;
        datasetId?: string;
        query?: Record<string, unknown>;
        timestamp: string;
      }>;
      artifacts: {
        reportMd: string;
        reportPdf: string;
        metricsJson: string;
        routeHealthJson: string;
        geojson: string;
        recommendationsJson: string;
        questionAnswerJson: string;
        questionReportMd: string;
        questionReportPdf: string;
        contextCacheJson: string;
        auditLog: string;
        auditManifest: string;
      };
      audit: {
        ledgerPath: string;
        finalEventHash: string | null;
        verified: boolean;
      };
      humanReviewRequired: true;
    };

type AnswerFinding = {
  finding: string;
  evidenceRefs: string[];
  confidence: number;
};

type AnswerAction = {
  action: string;
  reason: string;
  evidenceRefs: string[];
  confidence: number;
};

export async function answerQuestion(options: AnswerQuestionOptions): Promise<QuestionAnswerResult> {
  const credentialStatus = await new CredentialManager().applyToProcessEnv();
  if (!options.mock && !liveDataReady(credentialStatus)) {
    const missing = ["MTA_API_KEY", "NYC_OPEN_DATA_APP_TOKEN"].filter(
      (name) => !credentialStatus.credentials[name as "MTA_API_KEY" | "NYC_OPEN_DATA_APP_TOKEN"].present
    );
    const optionalMissing = ["OPENAI_API_KEY", "NY511_API_KEY"].filter(
      (name) => !credentialStatus.credentials[name as "OPENAI_API_KEY" | "NY511_API_KEY"].present
    );
    return {
      status: "needs_configuration",
      summary: "ClearLane needs local credentials for live transit/open-data questions.",
      missing,
      optionalMissing,
      nextStep: "Ask the user to run `clearlane configure` in their terminal, or rerun with mock=true."
    };
  }

  const parsed = parseQuestion(options.question);
  const route = options.route ?? parsed.route ?? "M15";
  const borough = options.borough ?? parsed.borough ?? "Manhattan";
  const period = options.period ?? parsed.period ?? "weekday_am";
  const dateFrom = options.dateFrom ?? (!options.mock ? oneYearAgoDate() : undefined);
  const dateTo = options.dateTo;
  const outDir = options.outDir;
  await mkdir(outDir, { recursive: true });

  const audit = await runAudit({
    route,
    borough,
    period,
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    outDir,
    ...(options.evidenceDir ? { evidenceDir: options.evidenceDir } : {}),
    mock: options.mock,
    format: "all"
  });

  const ledger = await AuditLedger.open(audit.artifacts.auditLog);
  await ledger.append({
    actor: "QuestionAnswerAgent",
    action: "receive_natural_language_question",
    input_refs: [options.question],
    output_refs: [`route:${route}`, `period:${period}`],
    source_refs: audit.routeHealth.sourceRefs,
    claim: `Received and normalized a natural-language ClearLane question for route ${route}.`,
    confidence: route ? 0.86 : 0.58,
    metadata: {
      parsed,
      dateFrom,
      dateTo,
      refresh: options.refresh ?? true,
      mock: options.mock
    }
  });

  const answer = buildAnswer(options.question, audit.routeHealth);
  const questionAnswerJson = path.join(outDir, "question-answer.json");
  const questionReportMd = path.join(outDir, "question-report.md");
  const questionReportPdf = path.join(outDir, "question-report.pdf");
  const contextCacheJson = path.join(outDir, "context-cache.json");
  const artifacts = {
    ...audit.artifacts,
    questionAnswerJson,
    questionReportMd,
    questionReportPdf,
    contextCacheJson
  };
  const payload = {
    status: "complete" as const,
    question: options.question,
    route,
    borough,
    period,
    generatedAt: nowIso(),
    pitch: answer.pitch,
    summary: answer.summary,
    answer: answer.answer,
    keyFindings: answer.keyFindings,
    actionPoints: answer.actionPoints,
    mermaid: answer.mermaid,
    dataUsed: dataUsed(audit.routeHealth),
    artifacts,
    humanReviewRequired: true as const
  };
  await writeFile(questionAnswerJson, `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(contextCacheJson, `${JSON.stringify(audit.routeHealth, null, 2)}\n`);
  await writeFile(questionReportMd, questionMarkdown(payload, audit.routeHealth));
  await writeQuestionPdfReport(
    {
      question: payload.question,
      pitch: payload.pitch,
      summary: payload.summary,
      answer: payload.answer,
      mermaid: payload.mermaid,
      keyFindings: payload.keyFindings,
      actionPoints: payload.actionPoints,
      auditLog: artifacts.auditLog,
      auditManifest: artifacts.auditManifest
    },
    questionReportPdf
  );
  await ledger.append({
    actor: "QuestionAnswerAgent",
    action: "write_question_answer_artifacts",
    input_refs: [audit.artifacts.routeHealthJson, options.question],
    output_refs: [questionAnswerJson, questionReportMd, questionReportPdf, contextCacheJson],
    source_refs: audit.routeHealth.sourceRefs,
    claim: "Generated an auditable natural-language answer, Mermaid visualization, and context cache.",
    confidence: 0.84
  });
  await ledger.writeManifest(audit.artifacts.auditManifest, [
    audit.artifacts.reportMd,
    audit.artifacts.reportPdf,
    audit.artifacts.metricsJson,
    audit.artifacts.routeHealthJson,
    audit.artifacts.geojson,
    audit.artifacts.recommendationsJson,
    questionAnswerJson,
    questionReportMd,
    questionReportPdf,
    contextCacheJson,
    audit.artifacts.auditLog
  ]);
  const verification = await verifyLedgerFile(audit.artifacts.auditLog);
  return {
    status: "complete",
    summary: answer.summary,
    pitch: answer.pitch,
    answer: answer.answer,
    keyFindings: answer.keyFindings,
    actionPoints: answer.actionPoints,
    mermaid: answer.mermaid,
    dataUsed: dataUsed(audit.routeHealth),
    artifacts,
    audit: {
      ledgerPath: audit.artifacts.auditLog,
      finalEventHash: ledger.finalEventHash,
      verified: verification.ok
    },
    humanReviewRequired: true
  };
}

function buildAnswer(question: string, routeHealth: RouteHealth): {
  pitch: string;
  summary: string;
  answer: string;
  keyFindings: AnswerFinding[];
  actionPoints: AnswerAction[];
  mermaid: string;
} {
  if (isEnforcementQuestion(question)) return buildEnforcementAnswer(question, routeHealth);
  const top = routeHealth.bottlenecks[0];
  const lowest =
    routeHealth.metrics.lowestAvgSpeedMph === null
      ? "no available speed"
      : `${routeHealth.metrics.lowestAvgSpeedMph.toFixed(1)} mph`;
  const summary = `ClearLane analyzed ${routeHealth.route} for ${routeHealth.period} and found ${routeHealth.metrics.priorityBottlenecks} priority bottleneck(s); the lowest observed average speed was ${lowest}.`;
  const topLabel = top
    ? `${top.fromStop ?? top.segmentId} to ${top.toStop ?? "next stop"}`
    : "the requested corridor";
  const answer = [
    summary,
    top
      ? `The strongest operational signal is ${topLabel}, with severity ${top.severity} and ${top.avgSpeedMph?.toFixed(1) ?? "unavailable"} mph average speed.`
      : "No segment-level bottleneck was available in the current data.",
    `The answer combines MTA segment speed data, MTA Bus Time status where configured, NYC Open Data 311 complaint context, bus-lane context, optional vision evidence, and ClearLane scoring.`,
    "This is a decision-support finding, not an enforcement or legal determination; human review is required before action."
  ].join(" ");

  return {
    pitch: pitchLine(routeHealth),
    summary,
    answer: question.trim().endsWith("?") ? answer : `${answer} Requested question: ${question}`,
    keyFindings: routeHealth.bottlenecks.slice(0, 3).map((bottleneck) => ({
      finding: `${bottleneck.segmentId}: ${bottleneck.severity} bottleneck at ${bottleneck.avgSpeedMph?.toFixed(1) ?? "unknown"} mph.`,
      evidenceRefs: [`bottleneck:${bottleneck.segmentId}`],
      confidence: bottleneck.confidence
    })),
    actionPoints: routeHealth.recommendations.map((recommendation) => ({
      action: recommendation.action,
      reason: recommendation.reason,
      evidenceRefs: recommendation.evidenceRefs,
      confidence: recommendation.confidence
    })),
    mermaid: questionMermaid(question, routeHealth)
  };
}

function buildEnforcementAnswer(question: string, routeHealth: RouteHealth): {
  pitch: string;
  summary: string;
  answer: string;
  keyFindings: AnswerFinding[];
  actionPoints: AnswerAction[];
  mermaid: string;
} {
  const top = routeHealth.bottlenecks[0];
  const topLabel = top
    ? `${top.fromStop ?? top.segmentId} to ${top.toStop ?? "next stop"}`
    : "the highest-priority segment";
  const lowest =
    routeHealth.metrics.lowestAvgSpeedMph === null
      ? "unavailable"
      : `${routeHealth.metrics.lowestAvgSpeedMph.toFixed(1)} mph`;
  const busLaneCount = routeHealth.busLaneContexts?.length ?? routeHealth.routeContext.busLanes.length;
  const realtime =
    routeHealth.realtimeSnapshot?.sourceMode === "available"
      ? `${routeHealth.realtimeSnapshot.vehicleCount} live MTA Bus Time vehicle records`
      : `MTA Bus Time ${routeHealth.dataCompleteness.mtaRealtime}`;
  const topComplaint = routeHealth.complaintHotspots[0];
  const summary = `ClearLane recommends targeted, evidence-led enforcement review for ${routeHealth.route}: start with ${topLabel}, where observed average speed bottoms out at ${lowest}.`;
  const answer = [
    summary,
    `Because NYPD and agency enforcement resources are finite, ClearLane should be used as a targeting layer: combine MTA segment speeds, ${realtime}, ${routeHealth.metrics.relevant311Complaints} relevant 311 complaints, ${busLaneCount} bus-lane context records, and optional camera/field evidence to rank where review is most likely to improve bus reliability.`,
    "For camera and technology deployment, prioritize corridors where low speeds and bus-lane context overlap, then use fixed cameras, bus-mounted/mobile camera evidence, and field observations to triage locations for DOT/MTA/NYPD review.",
    "ClearLane should not make enforcement determinations, identify people, or read/report license plates; it should create an auditable shortlist with confidence scores, source queries, and human-review notes before any operational, legal, or automated-enforcement action."
  ].join(" ");
  const keyFindings: AnswerFinding[] = [
    ...(top
      ? [
          {
            finding: `${topLabel} is the top enforcement-review candidate: ${top.severity} severity, ${top.avgSpeedMph?.toFixed(1) ?? "unknown"} mph average speed.`,
            evidenceRefs: [`bottleneck:${top.segmentId}`, `segment:${top.segmentId}`],
            confidence: top.confidence
          }
        ]
      : []),
    {
      finding: `${routeHealth.metrics.relevant311Complaints} relevant 311 complaints were aggregated for curb, parking, traffic, street-condition, and bus-stop context.${topComplaint ? ` The largest category is ${topComplaint.complaintType} (${topComplaint.count}).` : ""}`,
      evidenceRefs: routeHealth.complaintHotspots.map((hotspot) => `311:${hotspot.complaintType}`),
      confidence: routeHealth.dataCompleteness.nyc311 === "available" ? 0.78 : 0.65
    },
    {
      finding: `${busLaneCount} bus-lane context records and ${realtime} were attached to help target locations and time windows for review.`,
      evidenceRefs: [
        ...(routeHealth.busLaneContexts ?? []).slice(0, 8).map((lane) => `bus-lane:${lane.id}`),
        "mta_bus_time_vehicle_monitoring"
      ],
      confidence: routeHealth.dataCompleteness.mtaRealtime === "available" ? 0.76 : 0.62
    }
  ];
  const actionPoints: AnswerAction[] = [
    {
      action: `Create a priority enforcement-review shortlist starting with ${topLabel}.`,
      reason:
        "This focuses finite enforcement capacity on the segment with the strongest combined speed, bus-lane, complaint, and operational signals.",
      evidenceRefs: top ? [`bottleneck:${top.segmentId}`, `segment:${top.segmentId}`] : ["route-health.json"],
      confidence: 0.84
    },
    {
      action: "Use cameras and technology as triage: compare fixed bus-lane cameras, bus-mounted/mobile evidence, 311 hotspots, and field observations before deployment.",
      reason:
        "A multi-signal shortlist is more defensible than reacting to isolated complaints or single images.",
      evidenceRefs: [
        "slow-segments.geojson",
        "route-health.json",
        ...(routeHealth.busLaneContexts ?? []).slice(0, 5).map((lane) => `bus-lane:${lane.id}`)
      ],
      confidence: 0.8
    },
    {
      action: "Schedule DOT/MTA/NYPD human review during the matching service period before any enforcement or automated-enforcement action.",
      reason:
        "ClearLane is decision support; agencies still need to confirm signage, bus-lane geometry, camera eligibility, recurring conditions, and legal authority.",
      evidenceRefs: ["audit-log.ndjson", "audit-manifest.json"],
      confidence: 0.86
    },
    {
      action: "Measure before/after bus speeds and complaints after a pilot deployment.",
      reason:
        "The same MTA segment-speed and 311 queries can show whether targeted camera or field enforcement improved reliability.",
      evidenceRefs: ["metrics.json", "question-answer.json"],
      confidence: 0.83
    }
  ];
  return {
    pitch: pitchLine(routeHealth),
    summary,
    answer: question.trim().endsWith("?") ? answer : `${answer} Requested question: ${question}`,
    keyFindings,
    actionPoints,
    mermaid: questionMermaid(question, routeHealth)
  };
}

function pitchLine(routeHealth: RouteHealth): string {
  const lowest =
    routeHealth.metrics.lowestAvgSpeedMph === null
      ? "unavailable"
      : `${routeHealth.metrics.lowestAvgSpeedMph.toFixed(1)} mph`;
  return `ClearLane turns scattered MTA, Bus Time, NYC Open Data, 311, and optional camera evidence into an audit-ready action plan; this run found ${routeHealth.metrics.priorityBottlenecks} priority bottleneck(s), a lowest observed speed of ${lowest}, and ${routeHealth.metrics.relevant311Complaints} relevant 311 complaints.`;
}

function dataUsed(routeHealth: RouteHealth): Array<{
  source: string;
  datasetId?: string;
  query?: Record<string, unknown>;
  timestamp: string;
}> {
  return routeHealth.sourceRefs.map((source) => ({
    source: source.source,
    ...(source.datasetId ? { datasetId: source.datasetId } : {}),
    ...(source.query ? { query: source.query } : {}),
    timestamp: source.timestamp
  }));
}

function questionMarkdown(
  payload: Omit<Extract<QuestionAnswerResult, { status: "complete" }>, "audit"> & {
    question: string;
    generatedAt: string;
    route: string;
    borough: string;
    period: Period;
  },
  routeHealth: RouteHealth
): string {
  return `# ClearLane Question Answer

Question: ${payload.question}
Route: ${payload.route}
Borough: ${payload.borough}
Period: ${payload.period}
Generated: ${payload.generatedAt}

## Answer

${payload.answer}

## Demo Pitch

${payload.pitch}

## Visual Summary

\`\`\`mermaid
${payload.mermaid.trim()}
\`\`\`

## Key Findings

${payload.keyFindings
  .map(
    (finding) => `- ${finding.finding}
  Evidence: ${finding.evidenceRefs.join(", ")}
  Confidence: ${finding.confidence}`
  )
  .join("\n")}

## Action Points

${payload.actionPoints
  .map(
    (action) => `- ${action.action}
  Reason: ${action.reason}
  Evidence: ${action.evidenceRefs.join(", ")}
  Confidence: ${action.confidence}`
  )
  .join("\n")}

## Data Used

${payload.dataUsed
  .map((source) => `- ${source.source}${source.datasetId ? ` (${source.datasetId})` : ""}`)
  .join("\n")}

## Audit

- Ledger: ${payload.artifacts.auditLog}
- Route-health JSON: ${payload.artifacts.routeHealthJson}
- Audit manifest: ${payload.artifacts.auditManifest}

${routeHealth.disclaimer}
`;
}

function parseQuestion(question: string): {
  route?: string;
  borough?: string;
  period?: Period;
} {
  const normalized = question.toLowerCase();
  const route = question.match(/\b([A-Z]{1,3}\d{1,3}[A-Z]?)\b/i)?.[1]?.toUpperCase();
  const borough = ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"].find((candidate) =>
    normalized.includes(candidate.toLowerCase())
  );
  const period = parsePeriod(normalized);
  return {
    ...(route ? { route } : {}),
    ...(borough ? { borough } : {}),
    ...(period ? { period } : {})
  };
}

function parsePeriod(normalized: string): Period | undefined {
  if (normalized.includes("weekday") && (normalized.includes("morning") || normalized.includes("am"))) {
    return "weekday_am";
  }
  if (normalized.includes("weekday") && (normalized.includes("afternoon") || normalized.includes("pm"))) {
    return "weekday_pm";
  }
  if (normalized.includes("midday")) return "midday";
  if (normalized.includes("evening")) return "evening";
  if (normalized.includes("weekend")) return "weekend";
  if (normalized.includes("all day") || normalized.includes("all periods")) return "all";
  const maybePeriod = normalized.match(/\b(weekday_am|weekday_pm|midday|evening|weekend|all)\b/)?.[1];
  return maybePeriod ? PeriodSchema.parse(maybePeriod) : undefined;
}

function oneYearAgoDate(): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10);
}
