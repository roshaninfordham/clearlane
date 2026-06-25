import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nowIso } from "../schemas/common.js";
import { pathExists } from "../core/paths.js";
import {
  CredentialName,
  CREDENTIAL_NAMES,
  LocalCredentialMetadata,
  LocalCredentialMetadataSchema,
  LocalCredentialValues,
  LocalCredentialValuesSchema
} from "./credentialSchemas.js";

export function clearLaneHome(): string {
  return process.env.CLEARLANE_HOME ?? path.join(os.homedir(), ".clearlane");
}

export function credentialsMetadataPath(): string {
  return path.join(clearLaneHome(), "credentials.json");
}

export function credentialsValuesPath(): string {
  return path.join(clearLaneHome(), "credentials.local.json");
}

export function configPath(): string {
  return path.join(clearLaneHome(), "config.json");
}

export async function readLocalCredentialValues(): Promise<Partial<Record<CredentialName, string>>> {
  if (!(await pathExists(credentialsValuesPath()))) return {};
  const raw = JSON.parse(await readFile(credentialsValuesPath(), "utf8")) as unknown;
  const parsed = LocalCredentialValuesSchema.parse(raw);
  return Object.fromEntries(
    Object.entries(parsed.values).filter((entry): entry is [CredentialName, string] =>
      CREDENTIAL_NAMES.includes(entry[0] as CredentialName)
    )
  ) as Partial<Record<CredentialName, string>>;
}

export async function writeLocalCredentialValues(
  values: Partial<Record<CredentialName, string>>
): Promise<void> {
  await mkdir(clearLaneHome(), { recursive: true });
  const existing = await readExistingValues();
  const createdAt = existing.createdAt ?? nowIso();
  const payload: LocalCredentialValues = {
    version: 1,
    createdAt,
    updatedAt: nowIso(),
    values: { ...existing.values, ...values }
  };
  const metadata: LocalCredentialMetadata = {
    version: 1,
    createdAt,
    updatedAt: payload.updatedAt,
    credentials: Object.fromEntries(
      Object.entries(payload.values).map(([name]) => [
        name,
        { present: true, storage: "local-file" as const }
      ])
    )
  };
  await writeFile(credentialsValuesPath(), `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600
  });
  await writeFile(credentialsMetadataPath(), `${JSON.stringify(metadata, null, 2)}\n`, {
    mode: 0o600
  });
  await chmodBestEffort(credentialsValuesPath(), 0o600);
  await chmodBestEffort(credentialsMetadataPath(), 0o600);
}

export async function resetLocalCredentials(): Promise<void> {
  await rm(credentialsValuesPath(), { force: true });
  await rm(credentialsMetadataPath(), { force: true });
}

export async function readLocalCredentialMetadata(): Promise<LocalCredentialMetadata | null> {
  if (!(await pathExists(credentialsMetadataPath()))) return null;
  return LocalCredentialMetadataSchema.parse(
    JSON.parse(await readFile(credentialsMetadataPath(), "utf8")) as unknown
  );
}

async function readExistingValues(): Promise<Partial<LocalCredentialValues>> {
  if (!(await pathExists(credentialsValuesPath()))) return { values: {} };
  try {
    return LocalCredentialValuesSchema.parse(
      JSON.parse(await readFile(credentialsValuesPath(), "utf8")) as unknown
    );
  } catch {
    return { values: {} };
  }
}

async function chmodBestEffort(filePath: string, mode: number): Promise<void> {
  try {
    await chmod(filePath, mode);
  } catch {
    // Windows and some filesystems may not support POSIX chmod semantics.
  }
}
