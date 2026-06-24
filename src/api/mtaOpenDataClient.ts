import { DATASETS } from "../data/datasetRegistry.js";
import { SegmentSpeed } from "../schemas/route.js";
import { SocrataClient } from "./socrataClient.js";

type RawSegment = Record<string, unknown>;

export class MtaOpenDataClient {
  private readonly client: SocrataClient;
  private readonly datasetId: string;

  constructor(appToken?: string, datasetId: string = DATASETS.mtaSegmentSpeeds.id) {
    this.client = new SocrataClient("https://data.ny.gov/resource", appToken);
    this.datasetId = datasetId;
  }

  async getSegmentSpeeds(route: string, limit = 50): Promise<SegmentSpeed[]> {
    const rows = await this.client.query<RawSegment>(this.datasetId, {
      where: `upper(route_id)='${route.toUpperCase().replace(/'/g, "''")}'`,
      limit
    });
    return rows.map((row, index) => normalizeSegment(row, route, index));
  }

  async sampleSchema(limit = 5): Promise<RawSegment[]> {
    return this.client.query<RawSegment>(this.datasetId, { limit });
  }
}

function normalizeSegment(row: RawSegment, route: string, index: number): SegmentSpeed {
  const get = (...keys: string[]): unknown => {
    for (const key of keys) {
      if (row[key] !== undefined) return row[key];
    }
    return undefined;
  };
  const avgSpeed = numberValue(get("average_speed", "avg_speed", "speed_mph", "avg_speed_mph"));
  const travelTime = numberValue(get("average_travel_time", "avg_travel_time", "travel_time_min"));
  const segmentId = String(get("segment_id", "segmentid", "bus_route_segment_id") ?? `segment-${index + 1}`);
  return {
    segmentId,
    route: String(get("route_id", "route", "published_line_name") ?? route),
    borough: stringValue(get("borough")),
    fromStop: stringValue(get("from_stop", "from_stop_name", "start_stop")),
    toStop: stringValue(get("to_stop", "to_stop_name", "end_stop")),
    street: stringValue(get("street", "roadway_name", "corridor")),
    direction: stringValue(get("direction", "direction_id")),
    ...(avgSpeed !== undefined ? { avgSpeedMph: avgSpeed } : {}),
    ...(travelTime !== undefined ? { avgTravelTimeMin: travelTime } : {}),
    sourceRefs: []
  };
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
