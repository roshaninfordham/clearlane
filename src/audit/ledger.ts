import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { nowIso } from "../schemas/common.js";
import { PACKAGE_NAME, VERSION } from "../core/version.js";
import { fileSha256, eventHash } from "./hashChain.js";
import { AuditEvent, AuditEventInput, AuditManifest } from "./schemas.js";

export class AuditLedger {
  readonly ledgerPath: string;
  private lastHash: string | null = null;

  private constructor(ledgerPath: string, lastHash: string | null) {
    this.ledgerPath = ledgerPath;
    this.lastHash = lastHash;
  }

  static async open(ledgerPath: string): Promise<AuditLedger> {
    await mkdir(path.dirname(ledgerPath), { recursive: true });
    const lastHash = await readLastHash(ledgerPath);
    return new AuditLedger(ledgerPath, lastHash);
  }

  get finalEventHash(): string | null {
    return this.lastHash;
  }

  async append(input: AuditEventInput): Promise<AuditEvent> {
    const eventWithoutHash = {
      event_id: randomUUID(),
      timestamp: nowIso(),
      actor: input.actor,
      action: input.action,
      input_refs: input.input_refs,
      output_refs: input.output_refs,
      source_refs: input.source_refs,
      ...(input.claim ? { claim: input.claim } : {}),
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      previous_hash: this.lastHash
    };
    const event: AuditEvent = {
      ...eventWithoutHash,
      event_hash: eventHash(eventWithoutHash)
    };
    await appendFile(this.ledgerPath, `${JSON.stringify(event)}\n`, "utf8");
    this.lastHash = event.event_hash;
    return event;
  }

  async writeManifest(manifestPath: string, artifactPaths: string[]): Promise<AuditManifest> {
    const artifacts = [];
    for (const artifactPath of artifactPaths) {
      try {
        artifacts.push({ path: artifactPath, sha256: await fileSha256(artifactPath) });
      } catch {
        // Missing optional artifacts are not included in the manifest.
      }
    }
    const manifest: AuditManifest = {
      generated_at: nowIso(),
      package_name: PACKAGE_NAME,
      package_version: VERSION,
      ledger_file: this.ledgerPath,
      ledger_sha256: await fileSha256(this.ledgerPath),
      final_event_hash: this.lastHash ?? "",
      artifacts
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return manifest;
  }
}

async function readLastHash(ledgerPath: string): Promise<string | null> {
  try {
    const raw = await readFile(ledgerPath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return null;
    const last = JSON.parse(lines[lines.length - 1] ?? "{}") as { event_hash?: string };
    return last.event_hash ?? null;
  } catch {
    return null;
  }
}
