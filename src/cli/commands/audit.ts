import { PeriodSchema } from "../../schemas/common.js";
import { runAudit } from "../../core/runAudit.js";
import { CredentialManager, liveDataReady } from "../../credentials/credentialManager.js";

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
  const credentialStatus = await new CredentialManager().applyToProcessEnv();
  if (!options.mock && !liveDataReady(credentialStatus)) {
    console.log("ClearLane needs local credentials for live transit/open-data queries.");
    console.log("");
    console.log("Missing live-data setup:");
    console.log("- MTA_API_KEY");
    console.log("- NYC_OPEN_DATA_APP_TOKEN");
    console.log("");
    console.log("Run:");
    console.log("clearlane configure");
    console.log("");
    console.log("Or run the demo without credentials:");
    console.log(
      `clearlane audit --route ${options.route} --borough ${options.borough ?? "Manhattan"} --period ${period} --mock --out ${options.out ?? "./output"}`
    );
    process.exitCode = 1;
    return;
  }
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
