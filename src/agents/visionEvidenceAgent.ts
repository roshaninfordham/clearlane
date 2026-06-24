import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import mockVisionFindings from "../data/mock/sample-vision-findings.json" with { type: "json" };
import { AuditLedger } from "../audit/ledger.js";
import { ClearLaneConfig } from "../core/config.js";
import { ensureDir, pathExists } from "../core/paths.js";
import { nowIso, SourceRef } from "../schemas/common.js";
import { extractFrames } from "../vision/frameExtractor.js";
import { preprocessImage } from "../vision/imagePreprocessor.js";
import { OpenAIVisionAnalyzer } from "../vision/openaiVisionAnalyzer.js";
import { VisionFinding, VisionFindingsSchema } from "../vision/visionSchemas.js";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv"]);

export type VisionEvidenceResult = {
  findings: VisionFinding[];
  sourceMode: "available" | "mock" | "unavailable" | "skipped";
};

export class VisionEvidenceAgent {
  constructor(
    private readonly config: ClearLaneConfig,
    private readonly ledger: AuditLedger
  ) {}

  async run(options: {
    evidenceDir: string;
    outDir: string;
    mock: boolean;
  }): Promise<VisionEvidenceResult> {
    const evidenceOutDir = path.join(options.outDir, "evidence");
    await ensureDir(evidenceOutDir);

    if (options.mock) {
      const findings = await this.mockFindings(evidenceOutDir);
      await this.ledger.append({
        actor: "VisionEvidenceAgent",
        action: "load_mock_vision_findings",
        input_refs: [options.evidenceDir],
        output_refs: findings.map((finding) => finding.evidencePath ?? "mock-evidence"),
        source_refs: [
          {
            source: "mock_vision_findings",
            datasetId: "src/data/mock/sample-vision-findings.json",
            timestamp: nowIso()
          }
        ],
        claim: `Loaded ${findings.length} mock optional vision evidence findings.`,
        confidence: 0.72
      });
      return { findings, sourceMode: "mock" };
    }

    const evidenceFiles = await collectEvidenceFiles(options.evidenceDir, evidenceOutDir);
    if (evidenceFiles.length === 0) {
      await this.ledger.append({
        actor: "VisionEvidenceAgent",
        action: "skip_vision_no_evidence",
        input_refs: [options.evidenceDir],
        output_refs: [],
        source_refs: [],
        claim: "No evidence files were found for optional vision analysis.",
        confidence: 0.9
      });
      return { findings: [], sourceMode: "skipped" };
    }

    const apiKey = process.env[this.config.dataSources.openaiVision.apiKeyEnv];
    if (!apiKey || !this.config.dataSources.openaiVision.enabled) {
      await this.ledger.append({
        actor: "VisionEvidenceAgent",
        action: "skip_vision_no_openai_key",
        input_refs: evidenceFiles,
        output_refs: [],
        source_refs: [],
        claim: "OpenAI vision analysis was skipped because OPENAI_API_KEY is not configured.",
        confidence: 0.95
      });
      return { findings: [], sourceMode: "unavailable" };
    }

    const analyzer = new OpenAIVisionAnalyzer({
      apiKey,
      model: this.config.dataSources.openaiVision.model
    });
    const findings: VisionFinding[] = [];
    for (const [index, file] of evidenceFiles.entries()) {
      const outputPath = path.join(
        evidenceOutDir,
        `analyzed-frame-${String(index + 1).padStart(3, "0")}.jpg`
      );
      await preprocessImage(file, outputPath);
      findings.push(await analyzer.analyzeImage(outputPath));
    }
    await this.ledger.append({
      actor: "VisionEvidenceAgent",
      action: "analyze_evidence_with_openai",
      input_refs: evidenceFiles,
      output_refs: findings.map((finding) => finding.evidencePath ?? "vision-finding"),
      source_refs: [
        {
          source: "openai_responses_api",
          description: "Structured vision finding model call; API key omitted.",
          timestamp: nowIso()
        } satisfies SourceRef
      ],
      claim: `Analyzed ${findings.length} evidence frame(s) with optional OpenAI vision.`,
      confidence: findings.length > 0 ? 0.75 : 0.4,
      metadata: { model: this.config.dataSources.openaiVision.model }
    });
    return { findings, sourceMode: "available" };
  }

  private async mockFindings(evidenceOutDir: string): Promise<VisionFinding[]> {
    const parsed = VisionFindingsSchema.parse(mockVisionFindings);
    const findings: VisionFinding[] = [];
    for (const [index, finding] of parsed.entries()) {
      const evidencePath = path.join(
        evidenceOutDir,
        `analyzed-frame-${String(index + 1).padStart(3, "0")}.jpg`
      );
      await sharp({
        create: {
          width: 960,
          height: 540,
          channels: 3,
          background: index === 0 ? "#d7e5f0" : "#e8dfd2"
        }
      })
        .jpeg({ quality: 82 })
        .toFile(evidencePath);
      findings.push({ ...finding, evidencePath });
    }
    return findings;
  }
}

async function collectEvidenceFiles(evidenceDir: string, frameDir: string): Promise<string[]> {
  if (!(await pathExists(evidenceDir))) return [];
  const entries = await readdir(evidenceDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(evidenceDir, entry.name);
    const ext = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) files.push(filePath);
    if (VIDEO_EXTENSIONS.has(ext)) files.push(...(await extractFrames(filePath, frameDir)));
  }
  return files.slice(0, 8);
}
