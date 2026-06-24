import { PACKAGE_NAME } from "../core/version.js";
import { localMcpCommand, npmMcpCommand } from "./genericMcp.js";

export function opencodeJsonc(local = false): string {
  const command = local ? localMcpCommand() : npmMcpCommand(PACKAGE_NAME);
  return `${JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      mcp: {
        clearlane: {
          type: "local",
          command: [command.command, ...command.args],
          enabled: true
        }
      }
    },
    null,
    2
  )}\n`;
}
