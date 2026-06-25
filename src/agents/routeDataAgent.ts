import m15SegmentSpeeds from "../data/mock/m15-segment-speeds.json" with { type: "json" };
import { MtaOpenDataClient } from "../api/mtaOpenDataClient.js";
import { AuditLedger } from "../audit/ledger.js";
import { ClearLaneConfig } from "../core/config.js";
import { Logger } from "../core/logger.js";
import { nowIso, Period, SourceRef } from "../schemas/common.js";
import { SegmentSpeed, SegmentSpeedSchema } from "../schemas/route.js";

export type RouteDataResult = {
  route: string;
  borough?: string;
  segments: SegmentSpeed[];
  sourceRefs: SourceRef[];
  sourceMode: "available" | "mock" | "unavailable";
};

export class RouteDataAgent {
  constructor(
    private readonly config: ClearLaneConfig,
    private readonly ledger: AuditLedger,
    private readonly logger: Logger
  ) {}

  async run(options: { route: string; borough?: string; period?: Period; mock: boolean }): Promise<RouteDataResult> {
    const sourceRef: SourceRef = {
      source: "mta_open_data_segment_speeds",
      datasetId: this.config.datasets.mtaSegmentSpeeds,
      description: "MTA Bus Route Segment Speeds",
      timestamp: nowIso()
    };

    if (!options.mock) {
      try {
        const appToken = process.env[this.config.dataSources.nycOpenData.appTokenEnv];
        const client = new MtaOpenDataClient(appToken, this.config.datasets.mtaSegmentSpeeds);
        const segments = await client.getSegmentSpeeds(options.route, 50, options.period);
        await this.ledger.append({
          actor: "RouteDataAgent",
          action: "fetch_mta_segment_speeds",
          input_refs: [options.route],
          output_refs: [`segments:${segments.length}`],
          source_refs: [{ ...sourceRef, query: { route: options.route, period: options.period, limit: 50 } }],
          claim: `Fetched ${segments.length} segment speed rows from MTA Open Data.`,
          confidence: segments.length > 0 ? 0.8 : 0.3
        });
        if (segments.length > 0) {
          return {
            route: options.route,
            ...(options.borough ? { borough: options.borough } : {}),
            segments,
            sourceRefs: [sourceRef],
            sourceMode: "available"
          };
        }
      } catch (error) {
        this.logger.warn(`MTA Open Data unavailable; using mock segment speeds. ${String(error)}`);
        await this.ledger.append({
          actor: "RouteDataAgent",
          action: "fetch_mta_segment_speeds_failed",
          input_refs: [options.route],
          output_refs: [],
          source_refs: [sourceRef],
          claim: "MTA Open Data request failed; mock segment speeds were used.",
          confidence: 0.6,
          metadata: { error: String(error) }
        });
      }
    }

    const mockRef: SourceRef = {
      source: "mock_mta_segment_speeds",
      datasetId: "src/data/mock/m15-segment-speeds.json",
      description: "Bundled M15 demo segment speed data",
      timestamp: nowIso()
    };
    const segments = (m15SegmentSpeeds as unknown[]).map((row) =>
      SegmentSpeedSchema.parse({ ...(row as object), sourceRefs: [mockRef] })
    );
    await this.ledger.append({
      actor: "RouteDataAgent",
      action: "load_mock_segment_speeds",
      input_refs: [options.route],
      output_refs: [`segments:${segments.length}`],
      source_refs: [mockRef],
      claim: `Loaded ${segments.length} mock M15 segment speed records.`,
      confidence: 0.75
    });
    return {
      route: options.route,
      ...(options.borough ? { borough: options.borough } : {}),
      segments,
      sourceRefs: [mockRef],
      sourceMode: "mock"
    };
  }
}
