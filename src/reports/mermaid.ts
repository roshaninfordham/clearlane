import { RouteHealth } from "./reportSchemas.js";

export function routeHealthMermaid(routeHealth: RouteHealth): string {
  const top = routeHealth.bottlenecks.slice(0, 3);
  const complaints = routeHealth.complaintHotspots.slice(0, 3);
  const hasRealtime = routeHealth.realtimeSnapshot?.sourceMode === "available";
  const lines = [
    "flowchart TD",
    `  route["Route ${escapeMermaid(routeHealth.route)} ${routeHealth.borough ? `(${escapeMermaid(routeHealth.borough)})` : ""}"]`,
    `  speeds["MTA segment speeds<br/>${routeHealth.metrics.segmentsAnalyzed} segments"]`,
    `  realtime["MTA Bus Time<br/>${hasRealtime ? `${routeHealth.realtimeSnapshot?.vehicleCount ?? 0} vehicles` : routeHealth.dataCompleteness.mtaRealtime}"]`,
    `  complaints["NYC 311 context<br/>${routeHealth.metrics.relevant311Complaints} relevant complaints"]`,
    `  lanes["Bus lane context<br/>${routeHealth.busLaneContexts?.length ?? routeHealth.routeContext.busLanes.length} records"]`,
    `  findings["Priority findings<br/>${routeHealth.metrics.priorityBottlenecks} bottlenecks"]`,
    `  actions["Human-reviewed actions<br/>${routeHealth.recommendations.length} recommendations"]`,
    "  route --> speeds",
    "  route --> realtime",
    "  route --> lanes",
    "  complaints --> findings",
    "  speeds --> findings",
    "  realtime --> findings",
    "  lanes --> findings",
    "  findings --> actions"
  ];
  top.forEach((bottleneck, index) => {
    lines.push(
      `  b${index + 1}["${escapeMermaid(bottleneck.segmentId)}<br/>${escapeMermaid(bottleneck.severity)}${bottleneck.avgSpeedMph === undefined ? "" : `, ${bottleneck.avgSpeedMph.toFixed(1)} mph`}"]`
    );
    lines.push(`  findings --> b${index + 1}`);
  });
  complaints.forEach((hotspot, index) => {
    lines.push(`  c${index + 1}["${escapeMermaid(hotspot.complaintType)}<br/>${hotspot.count} complaints"]`);
    lines.push(`  c${index + 1} --> complaints`);
  });
  return `${lines.join("\n")}\n`;
}

function escapeMermaid(value: string): string {
  return value.replace(/["<>]/g, "").replace(/\|/g, "/");
}
