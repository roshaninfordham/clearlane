import { verifyLedgerFile } from "../../audit/verify.js";

export async function runVerifyLedgerCommand(ledgerPath: string): Promise<void> {
  const result = await verifyLedgerFile(ledgerPath);
  console.log(`Ledger valid: ${result.ok ? "yes" : "no"}`);
  console.log(`Events: ${result.events}`);
  console.log(`Final event hash: ${result.finalEventHash ?? "none"}`);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.log(`- ${error}`);
    process.exitCode = 1;
  }
}
