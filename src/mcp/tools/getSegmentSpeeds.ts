import { z } from "zod";
import { RouteDataAgent } from "../../agents/routeDataAgent.js";
import { AuditLedger } from "../../audit/ledger.js";
import { loadConfig } from "../../core/config.js";
import { createLogger } from "../../core/logger.js";
import { PeriodSchema } from "../../schemas/common.js";

export const GetSegmentSpeedsInputSchema = z.object({
  route: z.string(),
  borough: z.string().optional(),
  period: PeriodSchema.default("weekday_am"),
  outDir: z.string().default("./output"),
  mock: z.boolean().default(false)
});

export async function getSegmentSpeedsTool(input: z.infer<typeof GetSegmentSpeedsInputSchema>) {
  const config = await loadConfig();
  const ledger = await AuditLedger.open(`${input.outDir}/${config.audit.ledgerFile}`);
  return new RouteDataAgent(config, ledger, createLogger(false)).run({
    route: input.route,
    ...(input.borough ? { borough: input.borough } : {}),
    period: input.period,
    mock: input.mock
  });
}
