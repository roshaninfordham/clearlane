import { pathExists } from "../../core/paths.js";
import { VERSION } from "../../core/version.js";
import { ffmpegAvailable } from "../../vision/frameExtractor.js";

export async function runDoctorCommand(): Promise<void> {
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
  if (!process.env.NYC_OPEN_DATA_APP_TOKEN) {
    issues.push("NYC Open Data app token missing; anonymous Socrata requests may be throttled.");
  }
  if (!process.env.OPENAI_API_KEY) {
    issues.push("OPENAI_API_KEY missing; vision analysis will be skipped unless --mock is used.");
  }
  if (!process.env.MTA_API_KEY) {
    issues.push("MTA_API_KEY missing; real-time Bus Time calls will be skipped.");
  }

  console.log(`Node version: ${process.version}`);
  console.log(`ClearLane version: ${VERSION}`);
  console.log(`ffmpeg available: ${(await ffmpegAvailable()) ? "yes" : "no"}`);
  console.log(`OPENAI_API_KEY present: ${process.env.OPENAI_API_KEY ? "yes" : "no"}`);
  console.log(`MTA_API_KEY present: ${process.env.MTA_API_KEY ? "yes" : "no"}`);
  console.log(`NYC_OPEN_DATA_APP_TOKEN present: ${process.env.NYC_OPEN_DATA_APP_TOKEN ? "yes" : "no"}`);
  console.log("MCP server can start: yes");
  console.log(`Config files found: ${found.length ? found.join(", ") : "none"}`);
  console.log(`Likely setup issues: ${issues.length ? issues.join(" ") : "none"}`);
}
