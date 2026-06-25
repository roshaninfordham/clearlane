import { DATASETS } from "../data/datasetRegistry.js";
import { SocrataClient } from "./socrataClient.js";

export type ComplaintHotspot = {
  complaintType: string;
  count: number;
  latitude?: number;
  longitude?: number;
  dateRange?: {
    from: string;
    to: string;
  };
  source: "nyc_open_data_311" | "mock";
};

export type BusLaneContext = {
  id: string;
  label: string;
  borough?: string;
  street?: string;
  limits?: string;
  source: "nyc_open_data_bus_lanes" | "mock";
};

type RawComplaintRow = {
  complaint_type?: string;
  complaintType?: string;
  count?: string | number;
  latitude?: string | number;
  longitude?: string | number;
};

export class NycOpenDataClient {
  private readonly client: SocrataClient;
  private readonly datasetId: string;

  constructor(appToken?: string, datasetId: string = DATASETS.nyc311.id) {
    this.client = new SocrataClient("https://data.cityofnewyork.us/resource", appToken);
    this.datasetId = datasetId;
  }

  async query311Hotspots(options: {
    borough?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<ComplaintHotspot[]> {
    const relevantTypes = [
      "Illegal Parking",
      "Blocked Driveway",
      "Traffic",
      "Street Condition",
      "Bus Stop Shelter Complaint",
      "Bike/Roller/Skate Chronic"
    ];
    const whereParts = [
      `complaint_type in(${relevantTypes.map((type) => `'${type.replace(/'/g, "''")}'`).join(",")})`
    ];
    if (options.borough) whereParts.push(`upper(borough)='${options.borough.toUpperCase()}'`);
    if (options.dateFrom) whereParts.push(`created_date >= '${options.dateFrom}T00:00:00'`);
    if (options.dateTo) whereParts.push(`created_date <= '${options.dateTo}T23:59:59'`);

    const rows = await this.client.query<RawComplaintRow>(this.datasetId, {
      select:
        "complaint_type, count(*) as count, avg(latitude) as latitude, avg(longitude) as longitude",
      where: whereParts.join(" AND "),
      group: "complaint_type",
      order: "count DESC",
      limit: options.limit ?? 10
    });

    return rows.map((row) => {
      const latitude = numberValue(row.latitude);
      const longitude = numberValue(row.longitude);
      return {
        complaintType: String(row.complaint_type ?? row.complaintType ?? "Unknown"),
        count: numberValue(row.count) ?? 0,
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        ...(options.dateFrom || options.dateTo
          ? {
              dateRange: {
                from: options.dateFrom ?? "",
                to: options.dateTo ?? ""
              }
            }
          : {}),
        source: "nyc_open_data_311" as const
      };
    });
  }

  async queryBusLanes(options: {
    datasetId: string;
    route?: string;
    borough?: string;
    limit?: number;
  }): Promise<BusLaneContext[]> {
    const route = options.route?.toUpperCase().replace(/'/g, "''");
    const where = route
      ? `upper(sbs_route1)='${route}' OR upper(sbs_route2)='${route}' OR upper(sbs_route3)='${route}'`
      : undefined;
    const rows = await this.client.query<Record<string, unknown>>(options.datasetId, {
      ...(where ? { where } : {}),
      limit: options.limit ?? 25
    });
    const normalized = rows.map((row, index) => normalizeBusLane(row, index));
    const borough = normalizeBorough(options.borough)?.toUpperCase();
    return borough
      ? normalized.filter((lane) => !lane.borough || normalizeBorough(lane.borough)?.toUpperCase() === borough)
      : normalized;
  }

  async inspectDataset(datasetId: string, limit = 5): Promise<Record<string, unknown>[]> {
    return this.client.query<Record<string, unknown>>(datasetId, { limit });
  }
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeBusLane(row: Record<string, unknown>, index: number): BusLaneContext {
  const get = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return undefined;
  };
  const id = get("objectid", "segmentid", "segment_id", "id", "the_geom") ?? `bus-lane-${index + 1}`;
  const street = get("street", "street_name", "streetname", "roadway", "corridor", "on_street");
  const limits = get("limits", "from_to", "fromstreet", "from_street", "to_street", "to_st");
  const borough = normalizeBorough(get("borough", "boro", "borough_name"));
  const route = get("sbs_route1", "sbs_route2", "sbs_route3");
  const laneType = get("lane_type1", "lane_type", "lane_type2");
  const hours = get("hours");
  return {
    id,
    label:
      [street, limits, laneType, hours, route ? `Route ${route}` : undefined].filter(Boolean).join(" - ") ||
      `Bus lane record ${index + 1}`,
    ...(borough ? { borough } : {}),
    ...(street ? { street } : {}),
    ...(limits ? { limits } : {}),
    source: "nyc_open_data_bus_lanes"
  };
}

function normalizeBorough(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  const map: Record<string, string> = {
    MAN: "Manhattan",
    MN: "Manhattan",
    MANHATTAN: "Manhattan",
    BX: "Bronx",
    BRONX: "Bronx",
    BK: "Brooklyn",
    K: "Brooklyn",
    BROOKLYN: "Brooklyn",
    QN: "Queens",
    Q: "Queens",
    QUEENS: "Queens",
    SI: "Staten Island",
    R: "Staten Island",
    STATEN_ISLAND: "Staten Island",
    "STATEN ISLAND": "Staten Island"
  };
  return map[normalized] ?? value;
}
