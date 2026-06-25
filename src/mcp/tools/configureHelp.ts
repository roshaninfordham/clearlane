import { z } from "zod";

export const ConfigureHelpInputSchema = z.object({});

export async function configureHelpTool(): Promise<Record<string, unknown>> {
  return {
    message:
      "Run `clearlane configure` in your terminal to set up local credentials securely. You can skip any key you do not have.",
    commands: ["clearlane configure", "clearlane auth status", "clearlane doctor"],
    keys: [
      {
        name: "MTA_API_KEY",
        requiredFor: "MTA Bus Time realtime calls",
        optional: true
      },
      {
        name: "NYC_OPEN_DATA_APP_TOKEN",
        requiredFor: "Higher-rate NYC Open Data queries",
        optional: true
      },
      {
        name: "OPENAI_API_KEY",
        requiredFor: "Optional image/video evidence analysis",
        optional: true
      },
      {
        name: "NY511_API_KEY",
        requiredFor: "Future live traffic camera feed support",
        optional: true
      }
    ],
    security:
      "Do not paste API keys into chat. ClearLane MCP tools never request secret values as tool input."
  };
}
