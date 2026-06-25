import { z } from "zod";
import { VERSION } from "../../core/version.js";
import { CredentialManager } from "../../credentials/credentialManager.js";

export const HealthInputSchema = z.object({});

export async function healthTool(): Promise<Record<string, unknown>> {
  const status = await new CredentialManager().status();
  return {
    ok: true,
    version: VERSION,
    integrations: {
      openai: status.credentials.OPENAI_API_KEY.present,
      mta: status.credentials.MTA_API_KEY.present,
      nycOpenData: status.credentials.NYC_OPEN_DATA_APP_TOKEN.present
    }
  };
}
