import { CredentialName, CREDENTIAL_NAMES } from "./credentialSchemas.js";

export function readEnvironmentCredentials(): Partial<Record<CredentialName, string>> {
  const values: Partial<Record<CredentialName, string>> = {};
  for (const name of CREDENTIAL_NAMES) {
    const value = process.env[name];
    if (value && value.trim()) values[name] = value;
  }
  return values;
}
