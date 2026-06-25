import { createWriteStream } from "node:fs";
import PDFDocument from "pdfkit";
import { RouteHealth } from "./reportSchemas.js";

export async function writePdfReport(routeHealth: RouteHealth, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "LETTER" });
    const stream = createWriteStream(outputPath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);

    doc.fontSize(20).text("ClearLane Bus Reliability Audit", { underline: false });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Route: ${routeHealth.route}`);
    doc.text(`Borough: ${routeHealth.borough ?? "Not specified"}`);
    doc.text(`Period: ${routeHealth.period}`);
    doc.text(`Generated: ${routeHealth.generatedAt}`);
    doc.moveDown();

    section(doc, "Executive Summary");
    doc
      .fontSize(10)
      .text(
        `ClearLane identified ${routeHealth.metrics.priorityBottlenecks} priority bottleneck(s). Findings require human review before operational, enforcement, or policy action.`
      );
    doc.moveDown(0.5).text(routeHealth.disclaimer);

    section(doc, "Key Metrics");
    const lowest =
      routeHealth.metrics.lowestAvgSpeedMph === null
        ? "Unavailable"
        : `${routeHealth.metrics.lowestAvgSpeedMph.toFixed(1)} mph`;
    [
      ["Segments analyzed", routeHealth.metrics.segmentsAnalyzed],
      ["Priority bottlenecks", routeHealth.metrics.priorityBottlenecks],
      ["Lowest observed avg speed", lowest],
      ["Relevant 311 complaints nearby", routeHealth.metrics.relevant311Complaints],
      ["Vision evidence findings", routeHealth.metrics.visionFindings]
    ].forEach(([label, value]) => doc.fontSize(10).text(`${label}: ${value}`));

    section(doc, "Live and Street Context");
    doc
      .fontSize(10)
      .text(
        `MTA Bus Time: ${routeHealth.realtimeSnapshot?.sourceMode ?? routeHealth.dataCompleteness.mtaRealtime}${routeHealth.realtimeSnapshot?.sourceMode === "available" ? ` (${routeHealth.realtimeSnapshot.vehicleCount} vehicle records)` : ""}`
      );
    doc.text(`Bus lane context records: ${routeHealth.busLaneContexts?.length ?? routeHealth.routeContext.busLanes.length}`);

    section(doc, "Top Bottlenecks");
    routeHealth.bottlenecks.forEach((bottleneck, index) => {
      doc
        .fontSize(10)
        .text(
          `${index + 1}. ${bottleneck.fromStop ?? bottleneck.segmentId} to ${bottleneck.toStop ?? "next stop"} - ${bottleneck.avgSpeedMph?.toFixed(1) ?? "n/a"} mph, ${bottleneck.severity}`
        );
    });

    section(doc, "Recommendations");
    routeHealth.recommendations.forEach((recommendation, index) => {
      doc.fontSize(10).text(`${index + 1}. ${recommendation.action}`);
      doc.fontSize(9).text(`Reason: ${recommendation.reason}`);
    });

    section(doc, "Audit Appendix");
    doc.fontSize(10).text(`Ledger: ${routeHealth.audit.ledgerPath}`);
    doc.text(`Final ledger hash: ${routeHealth.audit.finalEventHash ?? "pending"}`);
    doc.end();
  });
}

function section(doc: PDFKit.PDFDocument, title: string): void {
  doc.moveDown(1);
  doc.fontSize(14).text(title);
  doc.moveDown(0.3);
}
