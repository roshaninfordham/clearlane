import busLanes from "../data/mock/m15-bus-lanes.json" with { type: "json" };
import routeContext from "../data/mock/m15-route-context.json" with { type: "json" };
import { AuditLedger } from "../audit/ledger.js";
import { nowIso, SourceRef } from "../schemas/common.js";
import { RouteContext, RouteContextSchema, SegmentSpeed } from "../schemas/route.js";

export type StreetContextResult = {
  routeContext: RouteContext;
  busLaneSegmentIds: string[];
};

export class StreetContextAgent {
  constructor(private readonly ledger: AuditLedger) {}

  async run(options: { route: string; borough?: string; segments: SegmentSpeed[] }): Promise<StreetContextResult> {
    const sourceRef: SourceRef = {
      source: "mock_route_context",
      datasetId: "src/data/mock/m15-route-context.json",
      timestamp: nowIso()
    };
    const context = RouteContextSchema.parse({
      ...(routeContext as object),
      route: options.route,
      ...(options.borough ? { borough: options.borough } : {}),
      sourceRefs: [sourceRef]
    });
    const busLaneSegmentIds = (busLanes as Array<{ segmentId: string }>).map((lane) => lane.segmentId);

    await this.ledger.append({
      actor: "StreetContextAgent",
      action: "attach_street_context",
      input_refs: options.segments.map((segment) => segment.segmentId),
      output_refs: ["route-context", ...busLaneSegmentIds.map((id) => `bus-lane:${id}`)],
      source_refs: [sourceRef],
      claim: `Attached route context and ${busLaneSegmentIds.length} bus-lane context records.`,
      confidence: 0.72
    });

    return { routeContext: context, busLaneSegmentIds };
  }
}
