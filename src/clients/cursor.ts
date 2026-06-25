import { globalMcpCommand, localMcpCommand } from "./genericMcp.js";

export function cursorMcpJson(local = false): string {
  const command = local ? localMcpCommand() : globalMcpCommand();
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
