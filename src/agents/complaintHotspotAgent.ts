import mockHotspots from "../data/mock/m15-311-hotspots.json" with { type: "json" };
import { ComplaintHotspot, NycOpenDataClient } from "../api/nycOpenDataClient.js";
import { AuditLedger } from "../audit/ledger.js";
import { ClearLaneConfig } from "../core/config.js";
import { Logger } from "../core/logger.js";
import { nowIso, SourceRef } from "../schemas/common.js";

export type ComplaintHotspotResult = {
  hotspots: ComplaintHotspot[];
  sourceMode: "available" | "mock" | "unavailable";
};

export class ComplaintHotspotAgent {
  constructor(
    private readonly config: ClearLaneConfig,
    private readonly ledger: AuditLedger,
    private readonly logger: Logger
  ) {}

  async run(options: {
    borough?: string;
    dateFrom?: string;
    dateTo?: string;
    mock: boolean;
  }): Promise<ComplaintHotspotResult> {
    const sourceRef: SourceRef = {
      source: "nyc_open_data_311",
      datasetId: this.config.datasets.nyc311,
      description: "311 Service Requests from 2020 to Present",
      timestamp: nowIso()
    };

    if (!options.mock) {
      try {
        const appToken = process.env[this.config.dataSources.nycOpenData.appTokenEnv];
        const client = new NycOpenDataClient(appToken, this.config.datasets.nyc311);
        const hotspots = await client.query311Hotspots(options);
        await this.ledger.append({
          actor: "ComplaintHotspotAgent",
          action: "query_311_hotspots",
          input_refs: [options.borough ?? "citywide"],
          output_refs: hotspots.map((hotspot) => `311:${hotspot.complaintType}`),
          source_refs: [
            {
              ...sourceRef,
              query: {
                borough: options.borough,
                dateFrom: options.dateFrom,
                dateTo: options.dateTo
              }
            }
          ],
          claim: `Aggregated ${hotspots.length} relevant 311 complaint hotspot groups.`,
          confidence: hotspots.length > 0 ? 0.78 : 0.45
        });
        return { hotspots, sourceMode: "available" };
      } catch (error) {
        this.logger.warn(`NYC Open Data 311 unavailable; using mock hotspots. ${String(error)}`);
        await this.ledger.append({
          actor: "ComplaintHotspotAgent",
          action: "query_311_hotspots_failed",
          input_refs: [options.borough ?? "citywide"],
          output_refs: [],
          source_refs: [sourceRef],
          claim: "NYC Open Data 311 request failed; mock hotspots were used.",
          confidence: 0.58,
          metadata: { error: String(error) }
        });
      }
    }

    const mockRef: SourceRef = {
      source: "mock_311_hotspots",
      datasetId: "src/data/mock/m15-311-hotspots.json",
      timestamp: nowIso()
    };
    const hotspots = (mockHotspots as Array<Record<string, unknown>>).map((hotspot) => {
      const latitude = typeof hotspot.latitude === "number" ? hotspot.latitude : undefined;
      const longitude = typeof hotspot.longitude === "number" ? hotspot.longitude : undefined;
      return {
        complaintType: String(hotspot.complaintType ?? "Unknown"),
        count: typeof hotspot.count === "number" ? hotspot.count : 0,
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        ...(hotspot.dateRange && typeof hotspot.dateRange === "object"
          ? { dateRange: hotspot.dateRange as { from: string; to: string } }
          : {}),
        source: "mock" as const
      } satisfies ComplaintHotspot;
    });
    await this.ledger.append({
      actor: "ComplaintHotspotAgent",
      action: "load_mock_311_hotspots",
      input_refs: [options.borough ?? "Manhattan"],
      output_refs: hotspots.map((hotspot) => `311:${hotspot.complaintType}`),
      source_refs: [mockRef],
      claim: `Loaded ${hotspots.reduce((sum, hotspot) => sum + hotspot.count, 0)} mock relevant 311 complaints.`,
      confidence: 0.7
    });
    return { hotspots, sourceMode: "mock" };
  }
}
