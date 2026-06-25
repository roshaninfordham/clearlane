import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AnalyzeEvidenceInputSchema, analyzeEvidenceTool } from "./tools/analyzeEvidence.js";
import { AuditRouteInputSchema, auditRouteTool } from "./tools/auditRoute.js";
import { ConfigureHelpInputSchema, configureHelpTool } from "./tools/configureHelp.js";
import { DoctorInputSchema, doctorTool } from "./tools/doctor.js";
import { ExportArtifactsInputSchema, exportArtifactsTool } from "./tools/exportArtifacts.js";
import { GenerateReportInputSchema, generateReportTool } from "./tools/generateReport.js";
import { GetSetupStatusInputSchema, getSetupStatusTool } from "./tools/getSetupStatus.js";
import { GetRouteContextInputSchema, getRouteContextTool } from "./tools/getRouteContext.js";
import { GetSegmentSpeedsInputSchema, getSegmentSpeedsTool } from "./tools/getSegmentSpeeds.js";
import { HealthInputSchema, healthTool } from "./tools/health.js";
import { Query311HotspotsInputSchema, query311HotspotsTool } from "./tools/query311Hotspots.js";
import { VerifyLedgerInputSchema, verifyLedgerTool } from "./tools/verifyLedger.js";

export function registerTools(server: McpServer): void {
  tool(server, "clearlane.health", "Check ClearLane MCP health and integration availability.", HealthInputSchema, healthTool);
  tool(server, "clearlane.get_setup_status", "Check whether ClearLane local credentials are configured.", GetSetupStatusInputSchema, getSetupStatusTool);
  tool(server, "clearlane.configure_help", "Explain secure local credential setup without requesting secrets.", ConfigureHelpInputSchema, configureHelpTool);
  tool(server, "clearlane.audit_route", "Run a full ClearLane bus reliability audit.", AuditRouteInputSchema, auditRouteTool);
  tool(server, "clearlane.get_segment_speeds", "Fetch or mock historical segment speeds.", GetSegmentSpeedsInputSchema, getSegmentSpeedsTool);
  tool(server, "clearlane.get_route_context", "Fetch route, street, and bus-lane context.", GetRouteContextInputSchema, getRouteContextTool);
  tool(server, "clearlane.query_311_hotspots", "Find relevant 311 complaint hotspots.", Query311HotspotsInputSchema, query311HotspotsTool);
  tool(server, "clearlane.analyze_evidence", "Analyze optional image/video evidence.", AnalyzeEvidenceInputSchema, analyzeEvidenceTool);
  tool(server, "clearlane.generate_report", "Generate Markdown and PDF reports from artifacts.", GenerateReportInputSchema, generateReportTool);
  tool(server, "clearlane.export_artifacts", "Read machine-readable ClearLane artifacts.", ExportArtifactsInputSchema, exportArtifactsTool);
  tool(server, "clearlane.verify_ledger", "Verify ClearLane audit ledger hash chain.", VerifyLedgerInputSchema, verifyLedgerTool);
  tool(server, "clearlane.doctor", "Return ClearLane setup diagnostics without exposing secret values.", DoctorInputSchema, doctorTool);
}

function tool<Input>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: any,
  handler: (input: Input) => Promise<unknown>
): void {
  server.registerTool(
    name,
    {
      title: name,
      description,
      inputSchema
    },
    async (input: Input) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(await handler(input), null, 2)
        }
      ]
    })
  );
}
