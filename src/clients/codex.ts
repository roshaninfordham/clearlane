import { globalMcpCommand, localMcpCommand } from "./genericMcp.js";

export function codexConfigToml(local = false): string {
  const command = local ? localMcpCommand() : globalMcpCommand();
  const args = command.args.map((arg) => `"${arg}"`).join(", ");
  return `[mcp_servers.clearlane]
command = "${command.command}"
args = [${args}]
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 180

[shell_environment_policy]
include_only = ["PATH", "HOME", "USER", "MTA_API_KEY", "NYC_OPEN_DATA_APP_TOKEN", "OPENAI_API_KEY", "NY511_API_KEY"]
`;
}
