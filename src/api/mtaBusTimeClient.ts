import { nowIso, SourceRef } from "../schemas/common.js";

export type RealtimeVehicle = {
  vehicleId?: string;
  lineRef?: string;
  directionRef?: string;
  latitude?: number;
  longitude?: number;
  bearing?: number;
  progressRate?: string;
  stopPointName?: string;
};

export type RealtimeBusSnapshot = {
  route: string;
  fetchedAt: string;
  sourceMode: "available" | "unavailable" | "skipped";
  vehicleCount: number;
  vehicles: RealtimeVehicle[];
  sourceRefs: SourceRef[];
  error?: string;
};

type SiriVehicleActivity = {
  MonitoredVehicleJourney?: {
    VehicleRef?: string;
    LineRef?: string;
    DirectionRef?: string;
    Bearing?: number | string;
    ProgressRate?: string;
    VehicleLocation?: {
      Latitude?: number | string;
      Longitude?: number | string;
    };
    MonitoredCall?: {
      StopPointName?: string;
    };
  };
};

export class MtaBusTimeClient {
  private readonly apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async health(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const url = new URL("https://bustime.mta.info/api/siri/vehicle-monitoring.json");
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("MaximumNumberOfCallsOnwards", "1");
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getVehicleSnapshot(route: string, maximumVehicles = 20): Promise<RealtimeBusSnapshot> {
    const sourceRef: SourceRef = {
      source: "mta_bus_time_vehicle_monitoring",
      description: "MTA Bus Time SIRI vehicle monitoring",
      url: "https://bustime.mta.info/api/siri/vehicle-monitoring.json",
      query: {
        route,
        maximumVehicles
      },
      timestamp: nowIso()
    };

    if (!this.apiKey) {
      return {
        route,
        fetchedAt: sourceRef.timestamp,
        sourceMode: "skipped",
        vehicleCount: 0,
        vehicles: [],
        sourceRefs: [sourceRef]
      };
    }

    const url = new URL("https://bustime.mta.info/api/siri/vehicle-monitoring.json");
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("MaximumNumberOfCallsOnwards", "1");
    url.searchParams.set("MaximumStopVisits", "1");
    url.searchParams.set("MaximumNumberOfVehicles", String(maximumVehicles));
    url.searchParams.set("LineRef", toMtaLineRef(route));

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const json = (await response.json()) as Record<string, unknown>;
      const activities = vehicleActivities(json);
      const vehicles = activities.map(normalizeVehicle).filter((vehicle) => vehicle.lineRef || vehicle.vehicleId);
      return {
        route,
        fetchedAt: nowIso(),
        sourceMode: "available",
        vehicleCount: vehicles.length,
        vehicles,
        sourceRefs: [sourceRef]
      };
    } catch (error) {
      return {
        route,
        fetchedAt: nowIso(),
        sourceMode: "unavailable",
        vehicleCount: 0,
        vehicles: [],
        sourceRefs: [sourceRef],
        error: String(error)
      };
    }
  }
}

function toMtaLineRef(route: string): string {
  const normalized = route.trim().toUpperCase();
  return normalized.startsWith("MTA NYCT_") ? normalized : `MTA NYCT_${normalized}`;
}

function vehicleActivities(json: Record<string, unknown>): SiriVehicleActivity[] {
  const siri = json.Siri as Record<string, unknown> | undefined;
  const serviceDelivery = siri?.ServiceDelivery as Record<string, unknown> | undefined;
  const deliveries = serviceDelivery?.VehicleMonitoringDelivery as Array<Record<string, unknown>> | undefined;
  const activity = deliveries?.[0]?.VehicleActivity;
  return Array.isArray(activity) ? (activity as SiriVehicleActivity[]) : [];
}

function normalizeVehicle(activity: SiriVehicleActivity): RealtimeVehicle {
  const journey = activity.MonitoredVehicleJourney ?? {};
  const location = journey.VehicleLocation ?? {};
  return {
    ...(journey.VehicleRef ? { vehicleId: String(journey.VehicleRef) } : {}),
    ...(journey.LineRef ? { lineRef: String(journey.LineRef) } : {}),
    ...(journey.DirectionRef ? { directionRef: String(journey.DirectionRef) } : {}),
    ...numberProp("latitude", location.Latitude),
    ...numberProp("longitude", location.Longitude),
    ...numberProp("bearing", journey.Bearing),
    ...(journey.ProgressRate ? { progressRate: journey.ProgressRate } : {}),
    ...(journey.MonitoredCall?.StopPointName ? { stopPointName: journey.MonitoredCall.StopPointName } : {})
  };
}

function numberProp<Key extends string>(key: Key, value: unknown): Partial<Record<Key, number>> {
  if (typeof value === "number" && Number.isFinite(value)) return { [key]: value } as Record<Key, number>;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return { [key]: parsed } as Record<Key, number>;
  }
  return {};
}
