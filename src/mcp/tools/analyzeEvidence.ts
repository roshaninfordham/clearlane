import { z } from "zod";
import { VisionEvidenceAgent } from "../../agents/visionEvidenceAgent.js";
import { AuditLedger } from "../../audit/ledger.js";
import { loadConfig } from "../../core/config.js";

export const AnalyzeEvidenceInputSchema = z.object({
  evidenceDir: z.string().default("./input/evidence"),
  outDir: z.string().default("./output"),
  mock: z.boolean().default(false)
});

export async function analyzeEvidenceTool(input: z.infer<typeof AnalyzeEvidenceInputSchema>) {
  const config = await loadConfig();
  const ledger = await AuditLedger.open(`${input.outDir}/${config.audit.ledgerFile}`);
  const result = await new VisionEvidenceAgent(config, ledger).run(input);
  return { findings: result.findings };
}
