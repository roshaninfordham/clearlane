import { NycOpenDataClient } from "../../api/nycOpenDataClient.js";
import { CredentialManager } from "../../credentials/credentialManager.js";

export async function runInspectSourceCommand(options: {
  dataset: string;
  limit?: string | number;
}): Promise<void> {
  const limit = Number(options.limit ?? 5);
  await new CredentialManager().applyToProcessEnv();
  const client = new NycOpenDataClient(process.env.NYC_OPEN_DATA_APP_TOKEN);
  const rows = await client.inspectDataset(options.dataset, limit);
  console.log(JSON.stringify(rows, null, 2));
}
