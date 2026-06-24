import { Bottleneck, SegmentSpeed } from "../schemas/route.js";

export function slowSegmentsGeoJson(segments: SegmentSpeed[], bottlenecks: Bottleneck[]): Record<string, unknown> {
  const bottleneckMap = new Map(bottlenecks.map((item) => [item.segmentId, item]));
  return {
    type: "FeatureCollection",
    features: segments
      .filter((segment) => bottleneckMap.has(segment.segmentId))
      .map((segment) => {
        const bottleneck = bottleneckMap.get(segment.segmentId);
        return {
          type: "Feature",
          geometry:
            segment.geometry ??
            (segment.centroid
              ? {
                  type: "Point",
                  coordinates: [segment.centroid.longitude, segment.centroid.latitude]
                }
              : null),
          properties: {
            segment_id: segment.segmentId,
            route: segment.route,
            from_stop: segment.fromStop ?? null,
            to_stop: segment.toStop ?? null,
            avg_speed_mph: segment.avgSpeedMph ?? null,
            severity: bottleneck?.severity ?? "unknown",
            confidence: bottleneck?.confidence ?? null,
            geometry_available: Boolean(segment.geometry)
          }
        };
      })
  };
}
