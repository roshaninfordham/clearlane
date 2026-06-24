import { startMcpServer } from "../../mcp/server.js";

export async function runMcpCommand(): Promise<void> {
  await startMcpServer();
}
