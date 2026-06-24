import { readFile } from "node:fs/promises";
import path from "node:path";
import { eventHash, fileSha256 } from "./hashChain.js";
import { AuditEventSchema, AuditManifestSchema } from "./schemas.js";

export type LedgerVerification = {
  ok: boolean;
  events: number;
  finalEventHash: string | null;
  ledgerSha256?: string;
  errors: string[];
};

export async function verifyLedgerFile(ledgerPath: string): Promise<LedgerVerification> {
  const errors: string[] = [];
  let previous: string | null = null;
  let events = 0;
  let raw = "";

  try {
    raw = await readFile(ledgerPath, "utf8");
  } catch (error) {
    return {
      ok: false,
      events: 0,
      finalEventHash: null,
      errors: [`Unable to read ledger: ${String(error)}`]
    };
  }

  const lines = raw.split(/\r?\n/).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      errors.push(`Line ${index + 1} is not valid JSON.`);
      continue;
    }
    const result = AuditEventSchema.safeParse(parsed);
    if (!result.success) {
      errors.push(`Line ${index + 1} does not match audit event schema.`);
      continue;
    }
    const { event_hash, ...withoutHash } = result.data;
    const expected = eventHash(withoutHash);
    if (expected !== event_hash) {
      errors.push(`Line ${index + 1} event_hash mismatch.`);
    }
    if (result.data.previous_hash !== previous) {
      errors.push(`Line ${index + 1} previous_hash mismatch.`);
    }
    previous = event_hash;
    events += 1;
  }

  const ledgerSha256 = await fileSha256(ledgerPath);
  const manifestPath = path.join(path.dirname(ledgerPath), "audit-manifest.json");
  try {
    const manifest = AuditManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
    if (manifest.ledger_sha256 !== ledgerSha256) {
      errors.push("Manifest ledger_sha256 does not match current ledger.");
    }
    if (manifest.final_event_hash !== previous) {
      errors.push("Manifest final_event_hash does not match ledger tail.");
    }
  } catch {
    // Manifest is optional for standalone ledger verification.
  }

  return {
    ok: errors.length === 0,
    events,
    finalEventHash: previous,
    ledgerSha256,
    errors
  };
}
