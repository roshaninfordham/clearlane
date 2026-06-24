import { z } from "zod";
import { VERSION } from "../../core/version.js";

export const HealthInputSchema = z.object({});

export async function healthTool(): Promise<Record<string, unknown>> {
  return {
    ok: true,
    version: VERSION,
    integrations: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      mta: Boolean(process.env.MTA_API_KEY),
      nycOpenData: true
    }
  };
}
