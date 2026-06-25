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

export function questionMermaid(question: string, routeHealth: RouteHealth): string {
  if (!isEnforcementQuestion(question)) return routeHealthMermaid(routeHealth);
  const top = routeHealth.bottlenecks[0];
  const topLabel = top?.segmentId ?? "priority segment";
  const complaints = routeHealth.metrics.relevant311Complaints;
  const busLanes = routeHealth.busLaneContexts?.length ?? routeHealth.routeContext.busLanes.length;
  const vehicles = routeHealth.realtimeSnapshot?.vehicleCount ?? 0;
  return `flowchart TD
  q["Question: targeted bus-lane enforcement"]
  mta["MTA speed data<br/>lowest ${routeHealth.metrics.lowestAvgSpeedMph?.toFixed(1) ?? "n/a"} mph"]
  realtime["MTA Bus Time<br/>${routeHealth.dataCompleteness.mtaRealtime === "available" ? `${vehicles} live vehicles` : routeHealth.dataCompleteness.mtaRealtime}"]
  lanes["NYC bus-lane context<br/>${busLanes} records"]
  complaints["311 curb/traffic signals<br/>${complaints} relevant complaints"]
  score["ClearLane priority scoring<br/>speed + complaints + lane context + evidence"]
  target["Targeted review shortlist<br/>${escapeMermaid(topLabel)}"]
  tech["Camera / technology triage<br/>fixed, bus-mounted, field evidence"]
  review["Human review + legal eligibility<br/>no face or plate identification by ClearLane"]
  action["Action plan<br/>deploy, verify, measure before/after"]
  q --> mta
  q --> realtime
  q --> lanes
  q --> complaints
  mta --> score
  realtime --> score
  lanes --> score
  complaints --> score
  score --> target
  target --> tech
  tech --> review
  review --> action
`;
}

export function isEnforcementQuestion(question: string): boolean {
  return /enforcement|enforce|camera|automated|bus lane obstruction|obstruction|parked|parking|nypd|traffic laws/i.test(
    question
  );
}

function escapeMermaid(value: string): string {
  return value.replace(/["<>]/g, "").replace(/\|/g, "/");
}
