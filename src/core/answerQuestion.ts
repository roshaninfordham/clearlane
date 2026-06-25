import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuditLedger } from "../audit/ledger.js";
import { verifyLedgerFile } from "../audit/verify.js";
import { routeHealthMermaid } from "../reports/mermaid.js";
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
  const outDir = path.resolve(options.outDir);
  await mkdir(outDir, { recursive: true });

  const audit = await runAudit({
    route,
    borough,
    period,
    ...(options.dateFrom ? { dateFrom: options.dateFrom } : {}),
    ...(options.dateTo ? { dateTo: options.dateTo } : {}),
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
      refresh: options.refresh ?? true,
      mock: options.mock
    }
  });

  const answer = buildAnswer(options.question, audit.routeHealth);
  const questionAnswerJson = path.join(outDir, "question-answer.json");
  const questionReportMd = path.join(outDir, "question-report.md");
  const contextCacheJson = path.join(outDir, "context-cache.json");
  const artifacts = {
    ...audit.artifacts,
    questionAnswerJson,
    questionReportMd,
    contextCacheJson
  };
  const payload = {
    status: "complete" as const,
    question: options.question,
    route,
    borough,
    period,
    generatedAt: nowIso(),
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
  await ledger.append({
    actor: "QuestionAnswerAgent",
    action: "write_question_answer_artifacts",
    input_refs: [audit.artifacts.routeHealthJson, options.question],
    output_refs: [questionAnswerJson, questionReportMd, contextCacheJson],
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
    contextCacheJson,
    audit.artifacts.auditLog
  ]);
  const verification = await verifyLedgerFile(audit.artifacts.auditLog);
  return {
    status: "complete",
    summary: answer.summary,
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
  summary: string;
  answer: string;
  keyFindings: AnswerFinding[];
  actionPoints: AnswerAction[];
  mermaid: string;
} {
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
    mermaid: routeHealthMermaid(routeHealth)
  };
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
