import busLanes from "../data/mock/m15-bus-lanes.json" with { type: "json" };
import routeContext from "../data/mock/m15-route-context.json" with { type: "json" };
import { BusLaneContext, NycOpenDataClient } from "../api/nycOpenDataClient.js";
import { AuditLedger } from "../audit/ledger.js";
import { ClearLaneConfig } from "../core/config.js";
import { Logger } from "../core/logger.js";
import { nowIso, SourceRef } from "../schemas/common.js";
import { RouteContext, RouteContextSchema, SegmentSpeed } from "../schemas/route.js";

export type StreetContextResult = {
  routeContext: RouteContext;
  busLaneSegmentIds: string[];
  busLaneContexts: BusLaneContext[];
  sourceMode: "available" | "mock" | "unavailable";
};

export class StreetContextAgent {
  constructor(
    private readonly config: ClearLaneConfig,
    private readonly ledger: AuditLedger,
    private readonly logger: Logger
  ) {}

  async run(options: {
    route: string;
    borough?: string;
    segments: SegmentSpeed[];
    mock: boolean;
  }): Promise<StreetContextResult> {
    if (!options.mock) {
      const live = await this.liveBusLaneContext(options);
      if (live) return live;
    }

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
    const busLaneContexts = (busLanes as Array<{ segmentId: string; description?: string }>).map((lane) => ({
      id: lane.segmentId,
      label: lane.description ?? lane.segmentId,
      ...(options.borough ? { borough: options.borough } : {}),
      source: "mock" as const
    }));

    await this.ledger.append({
      actor: "StreetContextAgent",
      action: "attach_street_context",
      input_refs: options.segments.map((segment) => segment.segmentId),
      output_refs: ["route-context", ...busLaneSegmentIds.map((id) => `bus-lane:${id}`)],
      source_refs: [sourceRef],
      claim: `Attached route context and ${busLaneSegmentIds.length} bus-lane context records.`,
      confidence: 0.72
    });

    return {
      routeContext: context,
      busLaneSegmentIds,
      busLaneContexts,
      sourceMode: "mock"
    };
  }

  private async liveBusLaneContext(options: {
    route: string;
    borough?: string;
    segments: SegmentSpeed[];
  }): Promise<StreetContextResult | null> {
    const sourceRef: SourceRef = {
      source: "nyc_open_data_bus_lanes",
      datasetId: this.config.datasets.nycBusLanes,
      description: "NYC Open Data Bus Lanes",
      timestamp: nowIso()
    };

    try {
      const appToken = process.env[this.config.dataSources.nycOpenData.appTokenEnv];
      const client = new NycOpenDataClient(appToken, this.config.datasets.nyc311);
      const lanes = await client.queryBusLanes({
        datasetId: this.config.datasets.nycBusLanes,
        route: options.route,
        ...(options.borough ? { borough: options.borough } : {}),
        limit: 50
      });
      if (!lanes.length) return null;

      const busLaneSegmentIds = options.segments
        .filter((segment) => segment.street && lanes.some((lane) => laneMatchesSegment(lane, segment)))
        .map((segment) => segment.segmentId);
      const busLaneRefs = busLaneSegmentIds.length
        ? busLaneSegmentIds
        : lanes.slice(0, 8).map((lane) => lane.id);
      const context = RouteContextSchema.parse({
        route: options.route,
        ...(options.borough ? { borough: options.borough } : {}),
        description: `Live bus-lane context fetched from NYC Open Data. ${lanes.length} candidate bus-lane records were normalized for analyst review.`,
        busLanes: lanes.slice(0, 12).map((lane) => lane.label),
        busStops: [],
        sourceRefs: [{ ...sourceRef, query: { borough: options.borough, limit: 50 } }]
      });
      await this.ledger.append({
        actor: "StreetContextAgent",
        action: "fetch_bus_lane_context",
        input_refs: [options.route, options.borough ?? "borough_unspecified"],
        output_refs: lanes.map((lane) => `bus-lane:${lane.id}`),
        source_refs: [{ ...sourceRef, query: { route: options.route, borough: options.borough, limit: 50 } }],
        claim: `Fetched ${lanes.length} live NYC Open Data bus-lane records for street context.`,
        confidence: 0.68
      });

      return {
        routeContext: context,
        busLaneSegmentIds: busLaneRefs,
        busLaneContexts: lanes,
        sourceMode: "available"
      };
    } catch (error) {
      this.logger.warn(`NYC bus-lane context unavailable; using mock route context. ${String(error)}`);
      await this.ledger.append({
        actor: "StreetContextAgent",
        action: "fetch_bus_lane_context_failed",
        input_refs: [options.route, options.borough ?? "borough_unspecified"],
        output_refs: [],
        source_refs: [sourceRef],
        claim: "NYC Open Data bus-lane request failed; route context fallback was used.",
        confidence: 0.55,
        metadata: { error: String(error) }
      });
      return null;
    }
  }
}

function laneMatchesSegment(lane: BusLaneContext, segment: SegmentSpeed): boolean {
  const street = segment.street?.toLowerCase();
  if (!street) return false;
  return [lane.street, lane.label].some((value) => value?.toLowerCase().includes(street));
}
