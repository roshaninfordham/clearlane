import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../core/paths.js";

export async function writeWithBackup(filePath: string, content: string): Promise<{
  filePath: string;
  backupPath?: string;
}> {
  await mkdir(path.dirname(filePath), { recursive: true });
  let backupPath: string | undefined;
  if (await pathExists(filePath)) {
    backupPath = `${filePath}.bak.${Date.now()}`;
    await copyFile(filePath, backupPath);
  }
  await writeFile(filePath, content, "utf8");
  return backupPath ? { filePath, backupPath } : { filePath };
}

export function npmMcpCommand(packageName: string): { command: string; args: string[] } {
  return {
    command: "npx",
    args: ["-y", packageName, "mcp"]
  };
}

export function localMcpCommand(): { command: string; args: string[] } {
  return {
    command: "node",
    args: ["./dist/mcp/server.js"]
  };
}
