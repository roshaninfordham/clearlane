import { pathExists } from "../../core/paths.js";
import { VERSION } from "../../core/version.js";
import { CredentialManager, statusForDisplay } from "../../credentials/credentialManager.js";
import { ffmpegAvailable } from "../../vision/frameExtractor.js";

export async function runDoctorCommand(): Promise<void> {
  const credentialStatus = await new CredentialManager().status();
  const configFiles = [
    "clearlane.config.json",
    ".cursor/mcp.json",
    ".codex/config.toml",
    "opencode.jsonc"
  ];
  const found = [];
  for (const file of configFiles) {
    if (await pathExists(file)) found.push(file);
  }
  const issues = [];
  if (!credentialStatus.credentials.NYC_OPEN_DATA_APP_TOKEN.present) {
    issues.push("NYC Open Data app token missing; anonymous Socrata requests may be throttled.");
  }
  if (!credentialStatus.credentials.OPENAI_API_KEY.present) {
    issues.push("OPENAI_API_KEY missing; vision analysis will be skipped unless --mock is used.");
  }
  if (!credentialStatus.credentials.MTA_API_KEY.present) {
    issues.push("MTA_API_KEY missing; real-time Bus Time calls will be skipped.");
  }

  console.log(`Node version: ${process.version}`);
  console.log(`ClearLane version: ${VERSION}`);
  console.log(`ffmpeg available: ${(await ffmpegAvailable()) ? "yes" : "no"}`);
  for (const line of statusForDisplay(credentialStatus)) console.log(line);
  console.log("MCP server can start: yes");
  console.log(`Config files found: ${found.length ? found.join(", ") : "none"}`);
  console.log(`Likely setup issues: ${issues.length ? issues.join(" ") : "none"}`);
}
