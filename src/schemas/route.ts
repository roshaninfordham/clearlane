import { z } from "zod";
import { SourceRefSchema } from "./common.js";

export const GeoPointSchema = z.object({
  latitude: z.number(),
  longitude: z.number()
});

export const SegmentSpeedSchema = z.object({
  segmentId: z.string(),
  route: z.string(),
  borough: z.string().optional(),
  fromStop: z.string().optional(),
  toStop: z.string().optional(),
  street: z.string().optional(),
  direction: z.string().optional(),
  avgSpeedMph: z.number().optional(),
  avgTravelTimeMin: z.number().optional(),
  reliabilityPct: z.number().optional(),
  sampleSize: z.number().optional(),
  geometry: z
    .object({
      type: z.literal("LineString"),
      coordinates: z.array(z.tuple([z.number(), z.number()]))
    })
    .optional(),
  centroid: GeoPointSchema.optional(),
  sourceRefs: z.array(SourceRefSchema).default([])
});

export type SegmentSpeed = z.infer<typeof SegmentSpeedSchema>;

export const RouteContextSchema = z.object({
  route: z.string(),
  borough: z.string().optional(),
  description: z.string().optional(),
  busLanes: z.array(z.string()).default([]),
  busStops: z.array(z.string()).default([]),
  sourceRefs: z.array(SourceRefSchema).default([])
});

export type RouteContext = z.infer<typeof RouteContextSchema>;

export const BottleneckSchema = z.object({
  segmentId: z.string(),
  fromStop: z.string().optional(),
  toStop: z.string().optional(),
  avgSpeedMph: z.number().optional(),
  avgTravelTimeMin: z.number().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  reason: z.string(),
  confidence: z.number().min(0).max(1)
});

export type Bottleneck = z.infer<typeof BottleneckSchema>;
