import { ComplaintHotspot } from "../api/nycOpenDataClient.js";
import { SegmentSpeed } from "../schemas/route.js";
import { haversineMeters } from "./distance.js";

export function nearbyComplaints(
  segment: SegmentSpeed,
  hotspots: ComplaintHotspot[],
  radiusMeters = 900
): ComplaintHotspot[] {
  if (!segment.centroid) return hotspots;
  return hotspots.filter((hotspot) => {
    if (hotspot.latitude === undefined || hotspot.longitude === undefined) return true;
    return haversineMeters(segment.centroid!, {
      latitude: hotspot.latitude,
      longitude: hotspot.longitude
    }) <= radiusMeters;
  });
}
