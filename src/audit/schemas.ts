import { z } from "zod";
import { SourceRefSchema } from "../schemas/common.js";

export const AuditEventSchema = z.object({
  event_id: z.string(),
  timestamp: z.string(),
  actor: z.string(),
  action: z.string(),
  input_refs: z.array(z.string()),
  output_refs: z.array(z.string()),
  source_refs: z.array(SourceRefSchema),
  claim: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  previous_hash: z.string().nullable(),
  event_hash: z.string()
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export type AuditEventInput = Omit<AuditEvent, "event_id" | "timestamp" | "previous_hash" | "event_hash">;

export const AuditManifestSchema = z.object({
  generated_at: z.string(),
  package_name: z.string(),
  package_version: z.string(),
  ledger_file: z.string(),
  ledger_sha256: z.string(),
  final_event_hash: z.string(),
  artifacts: z.array(
    z.object({
      path: z.string(),
      sha256: z.string()
    })
  )
});

export type AuditManifest = z.infer<typeof AuditManifestSchema>;
