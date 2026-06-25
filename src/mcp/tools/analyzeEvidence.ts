import { z } from "zod";
import { VisionEvidenceAgent } from "../../agents/visionEvidenceAgent.js";
import { AuditLedger } from "../../audit/ledger.js";
import { loadConfig } from "../../core/config.js";
import { CredentialManager } from "../../credentials/credentialManager.js";

export const AnalyzeEvidenceInputSchema = z.object({
  evidenceDir: z.string().default("./input/evidence"),
  outDir: z.string().default("./output"),
  mock: z.boolean().default(false)
});

export async function analyzeEvidenceTool(input: z.infer<typeof AnalyzeEvidenceInputSchema>) {
  const config = await loadConfig();
  const status = await new CredentialManager().applyToProcessEnv();
  if (!input.mock && !status.credentials.OPENAI_API_KEY.present) {
    return {
      status: "needs_configuration",
      missing: ["OPENAI_API_KEY"],
      nextStep: "Run `clearlane configure`, or use mock=true."
    };
  }
  const ledger = await AuditLedger.open(`${input.outDir}/${config.audit.ledgerFile}`);
  const result = await new VisionEvidenceAgent(config, ledger).run(input);
  return { status: "complete", findings: result.findings };
}
