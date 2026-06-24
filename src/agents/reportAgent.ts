import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuditLedger } from "../audit/ledger.js";
import { AuditManifest } from "../audit/schemas.js";
import { slowSegmentsGeoJson } from "../geo/geojson.js";
import { ArtifactPaths } from "../schemas/artifacts.js";
import { markdownReport } from "../reports/markdownReport.js";
import { writePdfReport } from "../reports/pdfReport.js";
import { RouteHealth } from "../reports/reportSchemas.js";

export class ReportAgent {
  constructor(private readonly ledger: AuditLedger) {}

  async writeArtifacts(options: {
    outDir: string;
    routeHealth: RouteHealth;
    formats?: "md" | "pdf" | "json" | "all";
  }): Promise<{ artifacts: ArtifactPaths; manifest: AuditManifest }> {
    await mkdir(options.outDir, { recursive: true });
    const artifacts: ArtifactPaths = {
      reportMd: path.join(options.outDir, "report.md"),
      reportPdf: path.join(options.outDir, "report.pdf"),
      metricsJson: path.join(options.outDir, "metrics.json"),
      routeHealthJson: path.join(options.outDir, "route-health.json"),
      geojson: path.join(options.outDir, "slow-segments.geojson"),
      recommendationsJson: path.join(options.outDir, "recommendations.json"),
      auditLog: this.ledger.ledgerPath,
      auditManifest: path.join(options.outDir, "audit-manifest.json")
    };

    await writeFile(artifacts.metricsJson, `${JSON.stringify(options.routeHealth.metrics, null, 2)}\n`);
    await writeFile(
      artifacts.routeHealthJson,
      `${JSON.stringify(
        {
          ...options.routeHealth,
          audit: {
            ...options.routeHealth.audit,
            finalEventHash: this.ledger.finalEventHash
          }
        },
        null,
        2
      )}\n`
    );
    await writeFile(
      artifacts.geojson,
      `${JSON.stringify(slowSegmentsGeoJson(options.routeHealth.segments, options.routeHealth.bottlenecks), null, 2)}\n`
    );
    await writeFile(
      artifacts.recommendationsJson,
      `${JSON.stringify(options.routeHealth.recommendations, null, 2)}\n`
    );

    await this.ledger.append({
      actor: "ReportAgent",
      action: "write_json_artifacts",
      input_refs: ["route-health"],
      output_refs: [
        artifacts.metricsJson,
        artifacts.routeHealthJson,
        artifacts.geojson,
        artifacts.recommendationsJson
      ],
      source_refs: options.routeHealth.sourceRefs,
      claim: "Wrote machine-readable ClearLane audit artifacts.",
      confidence: 0.95
    });

    await writeFile(artifacts.reportMd, markdownReport(options.routeHealth));
    await writePdfReport(
      {
        ...options.routeHealth,
        audit: { ...options.routeHealth.audit, finalEventHash: this.ledger.finalEventHash }
      },
      artifacts.reportPdf
    );
    await this.ledger.append({
      actor: "ReportAgent",
      action: "write_human_readable_reports",
      input_refs: [
        artifacts.metricsJson,
        artifacts.routeHealthJson,
        artifacts.geojson,
        artifacts.recommendationsJson
      ],
      output_refs: [artifacts.reportMd, artifacts.reportPdf],
      source_refs: options.routeHealth.sourceRefs,
      claim: "Generated Markdown and PDF reports for human review.",
      confidence: 0.95
    });

    const manifest = await this.ledger.writeManifest(artifacts.auditManifest, [
      artifacts.reportMd,
      artifacts.reportPdf,
      artifacts.metricsJson,
      artifacts.routeHealthJson,
      artifacts.geojson,
      artifacts.recommendationsJson,
      artifacts.auditLog
    ]);

    const reportWithManifest = markdownReport(
      {
        ...options.routeHealth,
        audit: { ...options.routeHealth.audit, finalEventHash: manifest.final_event_hash }
      },
      manifest
    );
    await writeFile(artifacts.reportMd, reportWithManifest);
    await writePdfReport(
      {
        ...options.routeHealth,
        audit: { ...options.routeHealth.audit, finalEventHash: manifest.final_event_hash }
      },
      artifacts.reportPdf
    );
    const finalManifest = await this.ledger.writeManifest(artifacts.auditManifest, [
      artifacts.reportMd,
      artifacts.reportPdf,
      artifacts.metricsJson,
      artifacts.routeHealthJson,
      artifacts.geojson,
      artifacts.recommendationsJson,
      artifacts.auditLog
    ]);

    return { artifacts, manifest: finalManifest };
  }

  async regenerateFromRouteHealth(routeHealthPath: string, outDir: string): Promise<ArtifactPaths> {
    const routeHealth = JSON.parse(await readFile(routeHealthPath, "utf8")) as RouteHealth;
    const reportMd = path.join(outDir, "report.md");
    const reportPdf = path.join(outDir, "report.pdf");
    await writeFile(reportMd, markdownReport(routeHealth));
    await writePdfReport(routeHealth, reportPdf);
    return {
      reportMd,
      reportPdf,
      metricsJson: path.join(outDir, "metrics.json"),
      routeHealthJson: routeHealthPath,
      geojson: path.join(outDir, "slow-segments.geojson"),
      recommendationsJson: path.join(outDir, "recommendations.json"),
      auditLog: routeHealth.audit.ledgerPath,
      auditManifest: path.join(outDir, "audit-manifest.json")
    };
  }
}
