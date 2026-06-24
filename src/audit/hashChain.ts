import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { canonicalJson } from "./canonicalJson.js";

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function eventHash(eventWithoutHash: Record<string, unknown>): string {
  return sha256(canonicalJson(eventWithoutHash));
}

export async function fileSha256(filePath: string): Promise<string> {
  return sha256(await readFile(filePath));
}
