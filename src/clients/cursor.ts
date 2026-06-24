import { PACKAGE_NAME } from "../core/version.js";
import { localMcpCommand, npmMcpCommand } from "./genericMcp.js";

export function cursorMcpJson(local = false): string {
  const command = local ? localMcpCommand() : npmMcpCommand(PACKAGE_NAME);
  return `${JSON.stringify(
    {
      mcpServers: {
        clearlane: {
          command: command.command,
          args: command.args
        }
      }
    },
    null,
    2
  )}\n`;
}
