import { z } from "zod";
import { verifyLedgerFile } from "../../audit/verify.js";

export const VerifyLedgerInputSchema = z.object({
  ledgerPath: z.string().default("./output/audit-log.ndjson")
});

export async function verifyLedgerTool(input: z.infer<typeof VerifyLedgerInputSchema>) {
  return verifyLedgerFile(input.ledgerPath);
}
