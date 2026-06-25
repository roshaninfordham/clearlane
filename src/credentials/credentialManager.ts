import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../core/paths.js";
import {
  AuthStatus,
  CredentialName,
  CredentialSource,
  CREDENTIAL_NAMES
} from "./credentialSchemas.js";
import { readEnvironmentCredentials } from "./environmentCredentials.js";
import {
  configPath,
  readLocalCredentialMetadata,
  readLocalCredentialValues,
  resetLocalCredentials,
  writeLocalCredentialValues
} from "./localFileCredentials.js";

type ResolvedCredential = {
  name: CredentialName;
  value?: string;
  source: CredentialSource | null;
};

type ClearLaneUserConfig = {
  allowProjectEnv?: boolean;
};

export class CredentialManager {
  async status(): Promise<AuthStatus> {
    const resolved = await this.resolveAll();
    const credentials = Object.fromEntries(
      CREDENTIAL_NAMES.map((name) => {
        const credential = resolved[name];
        return [
          name,
          {
            present: Boolean(credential?.value),
            source: credential?.source ?? null
          }
        ];
      })
    ) as AuthStatus["credentials"];
    return {
      configured: Object.values(credentials).some((credential) => credential.present),
      credentials,
      capabilities: {
        mtaRealtime: credentials.MTA_API_KEY.present,
        nycOpenData: credentials.NYC_OPEN_DATA_APP_TOKEN.present,
        visionEvidence: credentials.OPENAI_API_KEY.present,
        cameraFeed: credentials.NY511_API_KEY.present,
        mockMode: true
      }
    };
  }

  async setupStatus(): Promise<{
    configured: boolean;
    missing: CredentialName[];
    optionalMissing: CredentialName[];
    capabilities: AuthStatus["capabilities"];
    nextStep?: { message: string; command: string };
  }> {
    const status = await this.status();
    const liveRequired: CredentialName[] = ["MTA_API_KEY", "NYC_OPEN_DATA_APP_TOKEN"];
    const optional: CredentialName[] = ["OPENAI_API_KEY", "NY511_API_KEY"];
    const missing = liveRequired.filter((name) => !status.credentials[name].present);
    const optionalMissing = optional.filter((name) => !status.credentials[name].present);
    return {
      configured: missing.length === 0,
      missing,
      optionalMissing,
      capabilities: status.capabilities,
      ...(missing.length
        ? {
            nextStep: {
              message:
                "ClearLane needs local credentials for live data. Ask the user to run: clearlane configure",
              command: "clearlane configure"
            }
          }
        : {})
    };
  }

  async resolveAll(): Promise<Record<CredentialName, ResolvedCredential>> {
    const env = readEnvironmentCredentials();
    const local = await readLocalCredentialValues();
    const project = await this.readProjectEnvCredentials();
    const resolved = {} as Record<CredentialName, ResolvedCredential>;
    for (const name of CREDENTIAL_NAMES) {
      if (env[name]) {
        resolved[name] = { name, value: env[name], source: "environment" };
      } else if (local[name]) {
        resolved[name] = { name, value: local[name], source: "local-file" };
      } else if (project[name]) {
        resolved[name] = { name, value: project[name], source: "project-env" };
      } else {
        resolved[name] = { name, source: null };
      }
    }
    return resolved;
  }

  async applyToProcessEnv(): Promise<AuthStatus> {
    const resolved = await this.resolveAll();
    for (const credential of Object.values(resolved)) {
      if (credential.value && !process.env[credential.name]) {
        process.env[credential.name] = credential.value;
      }
    }
    return this.status();
  }

  async saveLocal(values: Partial<Record<CredentialName, string>>): Promise<void> {
    await writeLocalCredentialValues(values);
  }

  async reset(): Promise<void> {
    await resetLocalCredentials();
  }

  async metadataPresent(): Promise<boolean> {
    return Boolean(await readLocalCredentialMetadata());
  }

  async enableProjectEnv(): Promise<void> {
    await writeUserConfig({ allowProjectEnv: true });
  }

  private async readProjectEnvCredentials(): Promise<Partial<Record<CredentialName, string>>> {
    const userConfig = await readUserConfig();
    if (!userConfig.allowProjectEnv || !(await pathExists(".env.local"))) return {};
    const raw = await readFile(".env.local", "utf8");
    const values: Partial<Record<CredentialName, string>> = {};
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const name = match[1] as CredentialName;
      if (!CREDENTIAL_NAMES.includes(name)) continue;
      values[name] = (match[2] ?? "").replace(/^["']|["']$/g, "");
    }
    return values;
  }
}

async function readUserConfig(): Promise<ClearLaneUserConfig> {
  if (!(await pathExists(configPath()))) return {};
  try {
    return JSON.parse(await readFile(configPath(), "utf8")) as ClearLaneUserConfig;
  } catch {
    return {};
  }
}

async function writeUserConfig(config: ClearLaneUserConfig): Promise<void> {
  await mkdir(path.dirname(configPath()), { recursive: true });
  await writeFile(configPath(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export function statusForDisplay(status: AuthStatus): string[] {
  return CREDENTIAL_NAMES.map((name) => {
    const credential = status.credentials[name];
    return `${name}: ${credential.present ? `present via ${credential.source}` : "missing"}`;
  });
}

export function liveDataReady(status: AuthStatus): boolean {
  return status.credentials.MTA_API_KEY.present || status.credentials.NYC_OPEN_DATA_APP_TOKEN.present;
}
