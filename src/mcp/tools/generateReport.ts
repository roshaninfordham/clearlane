import { z } from "zod";
import { AuditLedger } from "../../audit/ledger.js";
import { loadConfig } from "../../core/config.js";
import { ReportAgent } from "../../agents/reportAgent.js";

export const GenerateReportInputSchema = z.object({
  routeHealthPath: z.string().default("./output/route-health.json"),
  outDir: z.string().default("./output")
});

export async function generateReportTool(input: z.infer<typeof GenerateReportInputSchema>) {
  const config = await loadConfig();
  const ledger = await AuditLedger.open(`${input.outDir}/${config.audit.ledgerFile}`);
  return new ReportAgent(ledger).regenerateFromRouteHealth(input.routeHealthPath, input.outDir);
}
