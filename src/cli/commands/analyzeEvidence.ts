import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuditLedger } from "../../audit/ledger.js";
import { loadConfig } from "../../core/config.js";
import { VisionEvidenceAgent } from "../../agents/visionEvidenceAgent.js";

export async function runAnalyzeEvidenceCommand(
  evidenceDir: string,
  options: { out?: string; mock?: boolean }
): Promise<void> {
  const config = await loadConfig();
  const outDir = path.resolve(options.out ?? config.outputDir);
  await mkdir(outDir, { recursive: true });
  const ledger = await AuditLedger.open(path.join(outDir, config.audit.ledgerFile));
  const result = await new VisionEvidenceAgent(config, ledger).run({
    evidenceDir,
    outDir,
    mock: Boolean(options.mock)
  });
  const outputPath = path.join(outDir, "vision-findings.json");
  await writeFile(outputPath, `${JSON.stringify(result.findings, null, 2)}\n`);
  console.log(`Vision findings: ${outputPath}`);
  console.log(`Mode: ${result.sourceMode}`);
}
