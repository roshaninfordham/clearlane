import { createWriteStream } from "node:fs";
import PDFDocument from "pdfkit";

export type QuestionPdfInput = {
  question: string;
  pitch: string;
  summary: string;
  answer: string;
  mermaid: string;
  keyFindings: Array<{
    finding: string;
    evidenceRefs: string[];
    confidence: number;
  }>;
  actionPoints: Array<{
    action: string;
    reason: string;
    evidenceRefs: string[];
    confidence: number;
  }>;
  auditLog: string;
  auditManifest: string;
};

export async function writeQuestionPdfReport(input: QuestionPdfInput, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "LETTER" });
    const stream = createWriteStream(outputPath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);

    doc.fontSize(20).text("ClearLane Question Report");
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Question: ${input.question}`);
    doc.moveDown();

    section(doc, "Demo Pitch");
    doc.fontSize(10).text(input.pitch);

    section(doc, "Answer");
    doc.fontSize(10).text(input.answer);

    doc.addPage();
    section(doc, "Visual Summary");
    drawFlowDiagram(doc, input.mermaid);

    doc.addPage();
    section(doc, "Key Findings");
    input.keyFindings.forEach((finding, index) => {
      doc.fontSize(10).text(`${index + 1}. ${finding.finding}`);
      doc.fontSize(8).text(`Evidence: ${finding.evidenceRefs.join(", ") || "n/a"}`);
      doc.fontSize(8).text(`Confidence: ${finding.confidence}`);
    });

    section(doc, "Action Points");
    input.actionPoints.forEach((action, index) => {
      doc.fontSize(10).text(`${index + 1}. ${action.action}`);
      doc.fontSize(8).text(`Reason: ${action.reason}`);
      doc.fontSize(8).text(`Evidence: ${action.evidenceRefs.join(", ") || "n/a"}`);
      doc.fontSize(8).text(`Confidence: ${action.confidence}`);
    });

    section(doc, "Audit Trail");
    doc.fontSize(9).text(`Audit log: ${input.auditLog}`);
    doc.text(`Audit manifest: ${input.auditManifest}`);
    doc.end();
  });
}

function section(doc: PDFKit.PDFDocument, title: string): void {
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(14).text(title);
  doc.font("Helvetica");
  doc.moveDown(0.3);
}

type DiagramNode = {
  id: string;
  label: string;
};

function drawFlowDiagram(doc: PDFKit.PDFDocument, mermaid: string): void {
  const nodes = parseMermaidNodes(mermaid);
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  const order = lookup.has("q")
    ? [
        ["q"],
        ["mta", "realtime"],
        ["lanes", "complaints"],
        ["score"],
        ["target"],
        ["tech"],
        ["review"],
        ["action"]
      ]
    : [
        ["route"],
        ["speeds", "realtime"],
        ["lanes", "complaints"],
        ["findings"],
        ["actions"]
      ];
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y + 8;
  const boxWidth = 170;
  const boxHeight = 48;
  const rowGap = 18;
  const positions = new Map<string, { x: number; y: number; w: number; h: number }>();

  order.forEach((row, rowIndex) => {
    const present = row.filter((id) => lookup.has(id));
    if (!present.length) return;
    const totalWidth = present.length * boxWidth + (present.length - 1) * 18;
    let x = doc.page.margins.left + (pageWidth - totalWidth) / 2;
    const y = top + rowIndex * (boxHeight + rowGap);
    for (const id of present) {
      positions.set(id, { x, y, w: boxWidth, h: boxHeight });
      drawBox(doc, x, y, boxWidth, boxHeight, lookup.get(id)!.label, colorFor(id));
      x += boxWidth + 18;
    }
  });

  const edges = parseMermaidEdges(mermaid).filter(
    ([from, to]) => positions.has(from) && positions.has(to)
  );
  for (const [from, to] of edges) {
    drawArrow(doc, positions.get(from)!, positions.get(to)!);
  }
  const bottom = Math.max(...Array.from(positions.values()).map((position) => position.y + position.h), doc.y);
  doc.y = bottom + 12;
}

function parseMermaidNodes(mermaid: string): DiagramNode[] {
  const nodes: DiagramNode[] = [];
  for (const line of mermaid.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z][\w-]*)\["(.+)"\]\s*$/);
    if (!match) continue;
    nodes.push({
      id: match[1]!,
      label: match[2]!.replace(/<br\s*\/?>/gi, "\n")
    });
  }
  return nodes;
}

function parseMermaidEdges(mermaid: string): Array<[string, string]> {
  const edges: Array<[string, string]> = [];
  for (const line of mermaid.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z][\w-]*)\s*-->\s*([A-Za-z][\w-]*)\s*$/);
    if (match) edges.push([match[1]!, match[2]!]);
  }
  return edges;
}

function drawBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  fill: string
): void {
  doc.save();
  doc.roundedRect(x, y, width, height, 8).fillAndStroke(fill, "#334155");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5);
  doc.text(label, x + 8, y + 9, {
    width: width - 16,
    height: height - 12,
    align: "center"
  });
  doc.restore();
}

function drawArrow(
  doc: PDFKit.PDFDocument,
  from: { x: number; y: number; w: number; h: number },
  to: { x: number; y: number; w: number; h: number }
): void {
  const startX = from.x + from.w / 2;
  const startY = from.y + from.h;
  const endX = to.x + to.w / 2;
  const endY = to.y;
  const midY = startY + Math.max(8, (endY - startY) / 2);
  doc.save();
  doc.strokeColor("#475569").lineWidth(1.2);
  doc.moveTo(startX, startY).lineTo(startX, midY).lineTo(endX, midY).lineTo(endX, endY - 4).stroke();
  doc
    .path(`M ${endX - 4} ${endY - 8} L ${endX} ${endY - 2} L ${endX + 4} ${endY - 8} Z`)
    .fill("#475569");
  doc.restore();
}

function colorFor(id: string): string {
  if (["q", "route"].includes(id)) return "#dbeafe";
  if (["mta", "speeds", "realtime"].includes(id)) return "#dcfce7";
  if (["lanes", "complaints"].includes(id)) return "#fef3c7";
  if (["score", "findings", "target"].includes(id)) return "#fee2e2";
  if (["tech", "review", "action", "actions"].includes(id)) return "#e0e7ff";
  return "#f8fafc";
}
