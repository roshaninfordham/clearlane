import { z } from "zod";

export const VisionFindingSchema = z.object({
  eventType: z.enum([
    "possible_bus_lane_blockage",
    "possible_bus_stop_blockage",
    "possible_double_parking",
    "possible_delivery_activity",
    "possible_bike_lane_blockage",
    "unclear"
  ]),
  vehicleType: z.enum(["bus", "delivery_van", "box_truck", "passenger_car", "bike", "unknown"]),
  locationContext: z.enum(["bus_lane", "bus_stop", "curb", "travel_lane", "bike_lane", "unknown"]),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  humanReviewRequired: z.boolean().default(true),
  evidencePath: z.string().optional(),
  source: z.enum(["openai_vision", "mock", "fallback"]).default("fallback")
});

export const VisionFindingsSchema = z.array(VisionFindingSchema);

export type VisionFinding = z.infer<typeof VisionFindingSchema>;
