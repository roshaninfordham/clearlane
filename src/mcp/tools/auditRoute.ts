import { z } from "zod";
import { runAudit } from "../../core/runAudit.js";
import { PeriodSchema } from "../../schemas/common.js";

export const AuditRouteInputSchema = z.object({
  route: z.string(),
  borough: z.string().optional(),
  period: PeriodSchema.default("weekday_am"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  outDir: z.string().default("./output"),
  mock: z.boolean().default(false),
  evidenceDir: z.string().optional()
});

export async function auditRouteTool(input: z.infer<typeof AuditRouteInputSchema>) {
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
    summary: result.summary,
    artifacts: {
      reportMd: result.artifacts.reportMd,
      reportPdf: result.artifacts.reportPdf,
      metricsJson: result.artifacts.metricsJson,
      geojson: result.artifacts.geojson,
      auditLog: result.artifacts.auditLog
    },
    topFindings: result.topFindings,
    humanReviewRequired: true
  };
}
