import { AuditLedger } from "../../audit/ledger.js";
import { loadConfig } from "../../core/config.js";
import { ReportAgent } from "../../agents/reportAgent.js";

export async function runReportCommand(options: { from: string; out?: string }): Promise<void> {
  const config = await loadConfig();
  const outDir = options.out ?? config.outputDir;
  const ledger = await AuditLedger.open(`${outDir}/${config.audit.ledgerFile}`);
  const artifacts = await new ReportAgent(ledger).regenerateFromRouteHealth(options.from, outDir);
  console.log(`Report: ${artifacts.reportMd}`);
  console.log(`PDF: ${artifacts.reportPdf}`);
}
