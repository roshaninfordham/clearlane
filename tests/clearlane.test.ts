import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { AuditLedger } from "../src/audit/ledger.js";
import { verifyLedgerFile } from "../src/audit/verify.js";
import { SocrataClient } from "../src/api/socrataClient.js";
import { runInit } from "../src/cli/commands/init.js";
import { runDoctorCommand } from "../src/cli/commands/doctor.js";
import { runAuthStatusCommand } from "../src/cli/commands/authStatus.js";
import { runAudit } from "../src/core/runAudit.js";
import { loadConfig } from "../src/core/config.js";
import { VisionEvidenceAgent } from "../src/agents/visionEvidenceAgent.js";
import { CredentialManager } from "../src/credentials/credentialManager.js";
import { auditRouteTool } from "../src/mcp/tools/auditRoute.js";
import { createMcpServer } from "../src/mcp/server.js";

const originalCwd = process.cwd();
const originalEnv = { ...process.env };

afterEach(() => {
  process.chdir(originalCwd);
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("audit ledger", () => {
  it("appends and verifies a hash chain", async () => {
    const dir = await tempDir();
    const ledger = await AuditLedger.open(path.join(dir, "audit-log.ndjson"));
    await ledger.append({
      actor: "test",
      action: "first",
      input_refs: [],
      output_refs: [],
      source_refs: [],
      confidence: 1
    });
    await ledger.append({
      actor: "test",
      action: "second",
      input_refs: ["first"],
      output_refs: ["second"],
      source_refs: [],
      confidence: 1
    });

    const result = await verifyLedgerFile(ledger.ledgerPath);
    expect(result.ok).toBe(true);
    expect(result.events).toBe(2);
    expect(result.finalEventHash).toBeTruthy();
  });

  it("fails verification when a line is tampered with", async () => {
    const dir = await tempDir();
    const ledger = await AuditLedger.open(path.join(dir, "audit-log.ndjson"));
    await ledger.append({
      actor: "test",
      action: "first",
      input_refs: [],
      output_refs: [],
      source_refs: [],
      claim: "original",
      confidence: 1
    });
    const raw = await readFile(ledger.ledgerPath, "utf8");
    await writeFile(ledger.ledgerPath, raw.replace("original", "tampered"));

    const result = await verifyLedgerFile(ledger.ledgerPath);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("event_hash mismatch");
  });
});

describe("mock audit", () => {
  it("produces all required artifacts and readable reports", async () => {
    const dir = await tempDir();
    const outDir = path.join(dir, "output");
    const result = await runAudit({
      route: "M15",
      borough: "Manhattan",
      period: "weekday_am",
      outDir,
      mock: true
    });

    for (const file of [
      "report.md",
      "report.pdf",
      "metrics.json",
      "route-health.json",
      "slow-segments.geojson",
      "recommendations.json",
      "audit-log.ndjson",
      "audit-manifest.json"
    ]) {
      await expect(stat(path.join(outDir, file))).resolves.toBeTruthy();
    }

    const report = await readFile(result.artifacts.reportMd, "utf8");
    expect(report).toContain("ClearLane Bus Reliability Audit");
    expect(report).toContain("Human Review Checklist");
    const metrics = JSON.parse(await readFile(result.artifacts.metricsJson, "utf8")) as {
      segmentsAnalyzed: number;
      priorityBottlenecks: number;
      relevant311Complaints: number;
      visionFindings: number;
    };
    expect(metrics.segmentsAnalyzed).toBe(12);
    expect(metrics.priorityBottlenecks).toBe(3);
    expect(metrics.relevant311Complaints).toBe(42);
    expect(metrics.visionFindings).toBe(2);
    expect((await verifyLedgerFile(result.artifacts.auditLog)).ok).toBe(true);
  });
});

describe("init generators", () => {
  it("creates Cursor config", async () => {
    await inTempCwd(async () => {
      await runInit({ client: "cursor", local: true });
      const content = await readFile(".cursor/mcp.json", "utf8");
      expect(content).toContain("dist/mcp/server.js");
    });
  });

  it("creates Codex config", async () => {
    await inTempCwd(async () => {
      await runInit({ client: "codex", local: true });
      const content = await readFile(".codex/config.toml", "utf8");
      expect(content).toContain("[mcp_servers.clearlane]");
      expect(content).toContain("OPENAI_API_KEY");
    });
  });

  it("creates OpenCode config", async () => {
    await inTempCwd(async () => {
      await runInit({ client: "opencode", local: true });
      const content = await readFile("opencode.jsonc", "utf8");
      expect(content).toContain("https://opencode.ai/config.json");
      expect(content).toContain("dist/mcp/server.js");
    });
  });
});

describe("clients and evidence", () => {
  it("builds Socrata query URLs", () => {
    const client = new SocrataClient("https://data.cityofnewyork.us/resource", "token");
    const url = client.buildUrl("erm2-nwe9", {
      select: "complaint_type,count(*)",
      where: "borough='MANHATTAN'",
      group: "complaint_type",
      order: "count DESC",
      limit: 5,
      offset: 10
    });
    expect(url).toContain("erm2-nwe9.json");
    expect(url).toContain("%24select=complaint_type%2Ccount");
    expect(url).toContain("%24where=borough%3D%27MANHATTAN%27");
    expect(url).toContain("%24limit=5");
    expect(url).toContain("%24offset=10");
  });

  it("returns mock vision findings when mock mode is enabled", async () => {
    const dir = await tempDir();
    const config = await loadConfig();
    const ledger = await AuditLedger.open(path.join(dir, "output", "audit-log.ndjson"));
    const result = await new VisionEvidenceAgent(config, ledger).run({
      evidenceDir: path.join(dir, "input", "evidence"),
      outDir: path.join(dir, "output"),
      mock: true
    });
    expect(result.sourceMode).toBe("mock");
    expect(result.findings).toHaveLength(2);
    await expect(stat(result.findings[0]!.evidencePath!)).resolves.toBeTruthy();
  });
});

describe("doctor", () => {
  it("does not print secret values", async () => {
    process.env.OPENAI_API_KEY = "sk-secret-value";
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runDoctorCommand();
    const output = spy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("OPENAI_API_KEY: present via environment");
    expect(output).not.toContain("sk-secret-value");
  });
});

describe("credential setup", () => {
  it("auth status never prints secret values", async () => {
    process.env.CLEARLANE_HOME = await tempDir();
    process.env.MTA_API_KEY = "mta-secret-value";
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runAuthStatusCommand();
    const output = spy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("MTA_API_KEY: present via environment");
    expect(output).not.toContain("mta-secret-value");
  });

  it("resolves environment variables before local file credentials", async () => {
    process.env.CLEARLANE_HOME = await tempDir();
    const manager = new CredentialManager();
    await manager.saveLocal({ MTA_API_KEY: "local-value" });
    process.env.MTA_API_KEY = "env-value";
    const resolved = await manager.resolveAll();
    expect(resolved.MTA_API_KEY.source).toBe("environment");
    expect(resolved.MTA_API_KEY.value).toBe("env-value");
  });
});

describe("mcp setup flow", () => {
  it("returns needs_configuration when live audit credentials are missing", async () => {
    process.env.CLEARLANE_HOME = await tempDir();
    delete process.env.MTA_API_KEY;
    delete process.env.NYC_OPEN_DATA_APP_TOKEN;
    const result = await auditRouteTool({
      route: "M15",
      borough: "Manhattan",
      period: "weekday_am",
      outDir: "./output",
      mock: false
    });
    expect(result.status).toBe("needs_configuration");
    expect(JSON.stringify(result)).toContain("clearlane configure");
  });

  it("creates an MCP server without credentials", async () => {
    process.env.CLEARLANE_HOME = await tempDir();
    delete process.env.MTA_API_KEY;
    delete process.env.NYC_OPEN_DATA_APP_TOKEN;
    const server = createMcpServer();
    expect(server).toBeTruthy();
  });
});

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "clearlane-test-"));
}

async function inTempCwd(fn: () => Promise<void>): Promise<void> {
  const dir = await tempDir();
  process.chdir(dir);
  await fn();
}
