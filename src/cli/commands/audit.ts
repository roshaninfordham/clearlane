import { PeriodSchema } from "../../schemas/common.js";
import { runAudit } from "../../core/runAudit.js";

export async function runAuditCommand(options: {
  route: string;
  borough?: string;
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  out?: string;
  mock?: boolean;
  withEvidence?: string;
  format?: "md" | "pdf" | "json" | "all";
  verbose?: boolean;
}): Promise<void> {
  const period = PeriodSchema.parse(options.period ?? "weekday_am");
  const result = await runAudit({
    route: options.route,
    ...(options.borough ? { borough: options.borough } : {}),
    period,
    ...(options.dateFrom ? { dateFrom: options.dateFrom } : {}),
    ...(options.dateTo ? { dateTo: options.dateTo } : {}),
    outDir: options.out ?? "./output",
    ...(options.withEvidence ? { evidenceDir: options.withEvidence } : {}),
    mock: Boolean(options.mock),
    format: options.format ?? "all",
    verbose: Boolean(options.verbose)
  });
  console.log(result.summary);
  console.log(`Report: ${result.artifacts.reportMd}`);
  console.log(`PDF: ${result.artifacts.reportPdf}`);
  console.log(`Ledger: ${result.artifacts.auditLog}`);
}
