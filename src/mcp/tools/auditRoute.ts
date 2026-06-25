import { z } from "zod";
import { runAudit } from "../../core/runAudit.js";
import { CredentialManager, liveDataReady } from "../../credentials/credentialManager.js";
import { PeriodSchema } from "../../schemas/common.js";

export const AuditRouteInputSchema = z.object({
  route: z.string(),
  borough: z.string().optional(),
  period: PeriodSchema.default("weekday_am"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  outDir: z.string().default("./output"),
  mock: z.boolean().default(false),
  evidenceDir: z.string().optional(),
  cameraUrl: z.string().optional()
});

export async function auditRouteTool(input: z.infer<typeof AuditRouteInputSchema>) {
  const credentialStatus = await new CredentialManager().applyToProcessEnv();
  if (!input.mock && !liveDataReady(credentialStatus)) {
    return {
      status: "needs_configuration",
      summary: "ClearLane needs local credentials for live transit/open-data queries.",
      missing: ["MTA_API_KEY", "NYC_OPEN_DATA_APP_TOKEN"],
      optionalMissing: ["OPENAI_API_KEY", "NY511_API_KEY"].filter(
        (name) => !credentialStatus.credentials[name as keyof typeof credentialStatus.credentials].present
      ),
      nextStep:
        "Ask the user to run `clearlane configure` in their terminal, or rerun this tool with mock=true."
    };
  }
  const result = await runAudit({
    route: input.route,
    ...(input.borough ? { borough: input.borough } : {}),
    period: input.period,
    ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
    ...(input.dateTo ? { dateTo: input.dateTo } : {}),
    outDir: input.outDir,
    mock: input.mock,
    ...(input.evidenceDir ? { evidenceDir: input.evidenceDir } : {})
  });
  return {
    status: "complete",
    summary: result.summary,
    artifacts: {
      reportMd: result.artifacts.reportMd,
      reportPdf: result.artifacts.reportPdf,
      metricsJson: result.artifacts.metricsJson,
      routeHealthJson: result.artifacts.routeHealthJson,
      geojson: result.artifacts.geojson,
      recommendationsJson: result.artifacts.recommendationsJson,
      auditLog: result.artifacts.auditLog,
      auditManifest: result.artifacts.auditManifest
    },
    topFindings: result.topFindings,
    humanReviewRequired: true
  };
}
