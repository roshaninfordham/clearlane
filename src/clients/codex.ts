import { PACKAGE_NAME } from "../core/version.js";
import { localMcpCommand, npmMcpCommand } from "./genericMcp.js";

export function codexConfigToml(local = false): string {
  const command = local ? localMcpCommand() : npmMcpCommand(PACKAGE_NAME);
  const args = command.args.map((arg) => `"${arg}"`).join(", ");
  return `[mcp_servers.clearlane]
command = "${command.command}"
args = [${args}]
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 180
env_vars = ["OPENAI_API_KEY", "MTA_API_KEY", "NYC_OPEN_DATA_APP_TOKEN"]
`;
}
