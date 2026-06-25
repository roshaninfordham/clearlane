import { z } from "zod";
import { RouteDataAgent } from "../../agents/routeDataAgent.js";
import { StreetContextAgent } from "../../agents/streetContextAgent.js";
import { AuditLedger } from "../../audit/ledger.js";
import { loadConfig } from "../../core/config.js";
import { createLogger } from "../../core/logger.js";

export const GetRouteContextInputSchema = z.object({
  route: z.string(),
  borough: z.string().optional(),
  outDir: z.string().default("./output"),
  mock: z.boolean().default(true)
});

export async function getRouteContextTool(input: z.infer<typeof GetRouteContextInputSchema>) {
  const config = await loadConfig();
  const ledger = await AuditLedger.open(`${input.outDir}/${config.audit.ledgerFile}`);
  const routeData = await new RouteDataAgent(config, ledger, createLogger(false)).run({
    route: input.route,
    ...(input.borough ? { borough: input.borough } : {}),
    mock: input.mock
  });
  return new StreetContextAgent(config, ledger, createLogger(false)).run({
    route: input.route,
    ...(input.borough ? { borough: input.borough } : {}),
    segments: routeData.segments,
    mock: input.mock
  });
}
