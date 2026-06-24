import { z } from "zod";
import { ComplaintHotspotAgent } from "../../agents/complaintHotspotAgent.js";
import { AuditLedger } from "../../audit/ledger.js";
import { loadConfig } from "../../core/config.js";
import { createLogger } from "../../core/logger.js";

export const Query311HotspotsInputSchema = z.object({
  borough: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  outDir: z.string().default("./output"),
  mock: z.boolean().default(false)
});

export async function query311HotspotsTool(input: z.infer<typeof Query311HotspotsInputSchema>) {
  const config = await loadConfig();
  const ledger = await AuditLedger.open(`${input.outDir}/${config.audit.ledgerFile}`);
  return new ComplaintHotspotAgent(config, ledger, createLogger(false)).run({
    ...(input.borough ? { borough: input.borough } : {}),
    ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
    ...(input.dateTo ? { dateTo: input.dateTo } : {}),
    mock: input.mock
  });
}
