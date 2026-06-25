import { z } from "zod";
import { CredentialManager } from "../../credentials/credentialManager.js";

export const GetSetupStatusInputSchema = z.object({});

export async function getSetupStatusTool(): Promise<Record<string, unknown>> {
  const setup = await new CredentialManager().setupStatus();
  return {
    configured: setup.configured,
    missing: setup.missing,
    optionalMissing: setup.optionalMissing,
    capabilities: setup.capabilities,
    ...(setup.nextStep ? { nextStep: setup.nextStep } : {})
  };
}
