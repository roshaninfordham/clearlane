import { z } from "zod";
import { CredentialManager } from "../../credentials/credentialManager.js";
import { VERSION } from "../../core/version.js";
import { ffmpegAvailable } from "../../vision/frameExtractor.js";

export const DoctorInputSchema = z.object({});

export async function doctorTool(): Promise<Record<string, unknown>> {
  const status = await new CredentialManager().status();
  return {
    version: VERSION,
    node: process.version,
    credentials: status.credentials,
    capabilities: status.capabilities,
    ffmpegAvailable: await ffmpegAvailable(),
    mcpServerCanStart: true
  };
}
