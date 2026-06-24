import { mkdir } from "node:fs/promises";
import path from "node:path";
import { codexConfigToml } from "../../clients/codex.js";
import { cursorMcpJson } from "../../clients/cursor.js";
import { writeWithBackup } from "../../clients/genericMcp.js";
import { opencodeJsonc } from "../../clients/opencode.js";
import { defaultConfig } from "../../core/config.js";

export type InitClient = "cursor" | "codex" | "opencode" | "all";

export async function runInit(options: { client: InitClient; local?: boolean }): Promise<string[]> {
  await mkdir("input/evidence", { recursive: true });
  await mkdir("output", { recursive: true });

  const written: string[] = [];
  const configResult = await writeWithBackup(
    "clearlane.config.json",
    `${JSON.stringify(defaultConfig(), null, 2)}\n`
  );
  written.push(label(configResult));

  const clients =
    options.client === "all" ? (["cursor", "codex", "opencode"] as const) : [options.client];
  for (const client of clients) {
    if (client === "cursor") {
      written.push(
        label(await writeWithBackup(path.join(".cursor", "mcp.json"), cursorMcpJson(Boolean(options.local))))
      );
    }
    if (client === "codex") {
      written.push(
        label(await writeWithBackup(path.join(".codex", "config.toml"), codexConfigToml(Boolean(options.local))))
      );
    }
    if (client === "opencode") {
      written.push(label(await writeWithBackup("opencode.jsonc", opencodeJsonc(Boolean(options.local)))));
    }
  }
  return written;
}

function label(result: { filePath: string; backupPath?: string }): string {
  return result.backupPath ? `${result.filePath} (backup: ${result.backupPath})` : result.filePath;
}
