#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { runAnalyzeEvidenceCommand } from "./commands/analyzeEvidence.js";
import { runAuditCommand } from "./commands/audit.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runInit, InitClient } from "./commands/init.js";
import { runInspectSourceCommand } from "./commands/inspectSource.js";
import { runMcpCommand } from "./commands/mcp.js";
import { runReportCommand } from "./commands/report.js";
import { runVerifyLedgerCommand } from "./commands/verifyLedger.js";
import { VERSION } from "../core/version.js";

const program = new Command();

program
  .name("clearlane")
  .description("ClearLane MCP: audit-ready bus reliability investigations.")
  .version(VERSION);

program
  .command("init")
  .description("Create ClearLane config and MCP client configuration.")
  .requiredOption("--client <client>", "cursor, codex, opencode, or all")
  .option("--local", "Point MCP config to local dist build instead of npm")
  .action(async (options: { client: InitClient; local?: boolean }) => {
    const written = await runInit(options);
    console.log("ClearLane initialized.");
    console.log(`Files written: ${written.join(", ")}`);
    console.log("Next steps:");
    console.log("1. Run npm run build if using --local.");
    console.log("2. Run clearlane doctor.");
    console.log("3. Run clearlane audit --route M15 --borough Manhattan --period weekday_am --mock --out ./output.");
  });

program
  .command("mcp")
  .description("Start the ClearLane MCP stdio server.")
  .action(runMcpCommand);

program
  .command("audit")
  .description("Run an audit-ready bus reliability investigation.")
  .requiredOption("--route <routeId>", "Route ID, for example M15")
  .option("--borough <borough>", "Borough name")
  .option("--period <period>", "weekday_am|weekday_pm|midday|evening|weekend|all", "weekday_am")
  .option("--date-from <YYYY-MM-DD>", "Start date")
  .option("--date-to <YYYY-MM-DD>", "End date")
  .option("--out <dir>", "Output directory", "./output")
  .option("--mock", "Use bundled demo data")
  .option("--with-evidence <dir>", "Evidence directory")
  .option("--format <format>", "md|pdf|json|all", "all")
  .option("--verbose", "Verbose logging")
  .action(runAuditCommand);

program
  .command("analyze-evidence")
  .description("Analyze optional image/video evidence.")
  .argument("<dir>", "Evidence directory")
  .option("--out <dir>", "Output directory", "./output")
  .option("--mock", "Use mock vision findings")
  .action(runAnalyzeEvidenceCommand);

program
  .command("report")
  .description("Regenerate reports from existing route-health JSON.")
  .requiredOption("--from <path>", "Path to route-health.json")
  .option("--out <dir>", "Output directory", "./output")
  .action(runReportCommand);

program
  .command("verify-ledger")
  .description("Verify a ClearLane audit ledger hash chain.")
  .argument("<ledger>", "Path to audit-log.ndjson")
  .action(runVerifyLedgerCommand);

program
  .command("doctor")
  .description("Print local setup diagnostics without exposing secret values.")
  .action(runDoctorCommand);

program
  .command("inspect-source")
  .description("Inspect a Socrata dataset sample.")
  .requiredOption("--dataset <datasetId>", "Socrata dataset ID")
  .option("--limit <n>", "Rows to fetch", "5")
  .action(runInspectSourceCommand);

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
