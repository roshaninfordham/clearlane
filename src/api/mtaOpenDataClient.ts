import { DATASETS } from "../data/datasetRegistry.js";
import { Period } from "../schemas/common.js";
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

  async getSegmentSpeeds(route: string, limit = 50, period?: Period): Promise<SegmentSpeed[]> {
    const where = [`upper(route_id)='${route.toUpperCase().replace(/'/g, "''")}'`, ...periodWhere(period)].join(
      " AND "
    );
    const rows = await this.client.query<RawSegment>(this.datasetId, {
      where,
      order: "average_road_speed ASC",
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
  const avgSpeed = numberValue(
    get("average_road_speed", "average_speed", "avg_speed", "speed_mph", "avg_speed_mph")
  );
  const travelTime = numberValue(get("average_travel_time", "avg_travel_time", "travel_time_min"));
  const fromStopId = stringValue(get("timepoint_stop_id", "from_stop_id"));
  const toStopId = stringValue(get("next_timepoint_stop_id", "to_stop_id"));
  const direction = stringValue(get("direction", "direction_id"));
  const stopOrder = stringValue(get("stop_order"));
  const segmentId = String(
    get("segment_id", "segmentid", "bus_route_segment_id") ??
      [route, direction, stopOrder, fromStopId, toStopId].filter(Boolean).join("-") ??
      `segment-${index + 1}`
  );
  const geometry = lineGeometry(row);
  const centroid = geometry
    ? {
        latitude: Number(((geometry.coordinates[0]![1] + geometry.coordinates[1]![1]) / 2).toFixed(6)),
        longitude: Number(((geometry.coordinates[0]![0] + geometry.coordinates[1]![0]) / 2).toFixed(6))
      }
    : undefined;
  const sampleSize = numberValue(get("bus_trip_count", "sample_size", "trip_count"));
  return {
    segmentId,
    route: String(get("route_id", "route", "published_line_name") ?? route),
    borough: stringValue(get("borough")),
    fromStop: stringValue(get("timepoint_stop_name", "from_stop", "from_stop_name", "start_stop")),
    toStop: stringValue(get("next_timepoint_stop_name", "to_stop", "to_stop_name", "end_stop")),
    street: stringValue(get("street", "roadway_name", "corridor")),
    direction,
    ...(avgSpeed !== undefined ? { avgSpeedMph: avgSpeed } : {}),
    ...(travelTime !== undefined ? { avgTravelTimeMin: travelTime } : {}),
    ...(sampleSize !== undefined ? { sampleSize } : {}),
    ...(geometry ? { geometry } : {}),
    ...(centroid ? { centroid } : {}),
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

function periodWhere(period?: Period): string[] {
  switch (period) {
    case "weekday_am":
      return ["day_of_week not in('Saturday','Sunday')", "hour_of_day between 6 and 9"];
    case "weekday_pm":
      return ["day_of_week not in('Saturday','Sunday')", "hour_of_day between 15 and 18"];
    case "midday":
      return ["day_of_week not in('Saturday','Sunday')", "hour_of_day between 10 and 14"];
    case "evening":
      return ["hour_of_day between 19 and 23"];
    case "weekend":
      return ["day_of_week in('Saturday','Sunday')"];
    case "all":
    case undefined:
      return [];
  }
}

function lineGeometry(row: RawSegment): SegmentSpeed["geometry"] | undefined {
  const start = pointCoordinates(row.timepoint_stop_georeference);
  const end = pointCoordinates(row.next_timepoint_stop_georeference);
  if (start && end) return { type: "LineString", coordinates: [start, end] };
  const startLat = numberValue(row.timepoint_stop_latitude);
  const startLon = numberValue(row.timepoint_stop_longitude);
  const endLat = numberValue(row.next_timepoint_stop_latitude);
  const endLon = numberValue(row.next_timepoint_stop_longitude);
  if (
    startLat !== undefined &&
    startLon !== undefined &&
    endLat !== undefined &&
    endLon !== undefined
  ) {
    return {
      type: "LineString",
      coordinates: [
        [startLon, startLat],
        [endLon, endLat]
      ]
    };
  }
  return undefined;
}

function pointCoordinates(value: unknown): [number, number] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const coordinates = (value as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return undefined;
  const lon = numberValue(coordinates[0]);
  const lat = numberValue(coordinates[1]);
  return lon !== undefined && lat !== undefined ? [lon, lat] : undefined;
}
