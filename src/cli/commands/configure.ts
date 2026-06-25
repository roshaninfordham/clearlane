import { appendFile, chmod } from "node:fs/promises";
import readline from "node:readline";
import { CredentialManager } from "../../credentials/credentialManager.js";
import { CredentialName, CREDENTIAL_NAMES } from "../../credentials/credentialSchemas.js";
import { runAuthStatusCommand } from "./authStatus.js";

const PROMPTS: Record<CredentialName, string> = {
  MTA_API_KEY: "MTA API key, optional",
  NYC_OPEN_DATA_APP_TOKEN: "NYC Open Data app token, optional",
  OPENAI_API_KEY: "OpenAI API key for optional vision/image analysis, optional",
  NY511_API_KEY: "NY511 API key for future camera feed support, optional"
};

export async function runConfigureCommand(options: {
  env?: boolean;
  localFile?: boolean;
  projectEnv?: boolean;
  reset?: boolean;
  showStatus?: boolean;
}): Promise<void> {
  const manager = new CredentialManager();

  if (options.showStatus) {
    await runAuthStatusCommand();
    return;
  }

  if (options.env) {
    printEnvInstructions();
    return;
  }

  if (options.reset) {
    await manager.reset();
    console.log("ClearLane local credentials were removed.");
    return;
  }

  const currentStatus = await manager.status();
  const values: Partial<Record<CredentialName, string>> = {};
  for (const name of CREDENTIAL_NAMES) {
    const existing = currentStatus.credentials[name];
    if (existing.present) {
      const overwrite = await promptLine(`${name} is already present via ${existing.source}. Overwrite locally? [y/N]: `);
      if (!/^y(es)?$/i.test(overwrite.trim())) continue;
    }
    const value = await promptMasked(`${PROMPTS[name]}: `);
    if (value.trim()) values[name] = value.trim();
  }

  if (Object.keys(values).length === 0) {
    console.log("No credentials were saved. ClearLane can still run with --mock.");
    return;
  }

  if (options.projectEnv) {
    await writeProjectEnv(values);
    await manager.enableProjectEnv();
    console.log("ClearLane credentials saved to project .env.local.");
    console.log("This mode is explicit local project storage. Do not commit .env.local.");
  } else {
    await manager.saveLocal(values);
    console.log("ClearLane credentials saved locally.");
    console.log("Storage: ~/.clearlane/credentials.local.json with owner-only permissions where supported.");
  }

  console.log("");
  await runAuthStatusCommand();
  console.log("");
  console.log("Next:");
  console.log('Ask your MCP client: "Use ClearLane to audit the M15 route for weekday AM reliability."');
}

function printEnvInstructions(): void {
  console.log("Set credentials as environment variables in your shell. Replace the placeholders locally:");
  console.log("");
  console.log('export MTA_API_KEY="<your-mta-api-key>"');
  console.log('export NYC_OPEN_DATA_APP_TOKEN="<your-nyc-open-data-app-token>"');
  console.log('export OPENAI_API_KEY="<your-openai-api-key>"');
  console.log('export NY511_API_KEY="<your-ny511-api-key>"');
  console.log("");
  console.log("Do not paste API keys into an AI chat or MCP tool call.");
}

async function writeProjectEnv(values: Partial<Record<CredentialName, string>>): Promise<void> {
  const lines = Object.entries(values).map(([name, value]) => `${name}=${JSON.stringify(value)}`);
  await appendFile(".env.local", `${lines.join("\n")}\n`, { mode: 0o600 });
  try {
    await chmod(".env.local", 0o600);
  } catch {
    // Best effort on non-POSIX filesystems.
  }
}

async function promptLine(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function promptMasked(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) return promptLine(prompt);
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve) => {
    let value = "";
    const onData = (char: string) => {
      if (char === "\u0003") {
        process.stdin.setRawMode(false);
        process.stdin.off("data", onData);
        process.stdout.write("\n");
        process.exit(130);
      }
      if (char === "\r" || char === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += char;
      process.stdout.write("*");
    };
    process.stdin.on("data", onData);
  });
}
