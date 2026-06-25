import { CredentialManager, statusForDisplay } from "../../credentials/credentialManager.js";

export async function runAuthStatusCommand(options: { json?: boolean } = {}): Promise<void> {
  const status = await new CredentialManager().status();
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log("ClearLane credential status:");
  console.log("");
  for (const line of statusForDisplay(status)) console.log(line);
  console.log("");
  console.log("Live data readiness:");
  console.log(`- MTA realtime: ${status.capabilities.mtaRealtime ? "available" : "unavailable"}`);
  console.log(`- NYC Open Data: ${status.capabilities.nycOpenData ? "available" : "anonymous/limited"}`);
  console.log(`- Vision evidence: ${status.capabilities.visionEvidence ? "available" : "unavailable without OPENAI_API_KEY"}`);
  console.log(`- Camera feed: ${status.capabilities.cameraFeed ? "available" : "unavailable without NY511_API_KEY"}`);
}
