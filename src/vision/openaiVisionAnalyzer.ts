import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { visionSystemPrompt } from "./privacy.js";
import { VisionFinding, VisionFindingSchema } from "./visionSchemas.js";

export class OpenAIVisionAnalyzer {
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(options: { apiKey?: string; model: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model;
  }

  async analyzeImage(imagePath: string): Promise<VisionFinding> {
    if (!this.apiKey) {
      return fallbackFinding(imagePath, "OpenAI API key is not configured.");
    }

    try {
      const client = new OpenAI({ apiKey: this.apiKey });
      const base64 = (await readFile(imagePath)).toString("base64");
      const response = await client.responses.create({
        model: this.model,
        temperature: 0,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: `${visionSystemPrompt()} Analyze this evidence image.` },
              { type: "input_image", image_url: `data:image/jpeg;base64,${base64}` }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "vision_finding",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                eventType: {
                  type: "string",
                  enum: [
                    "possible_bus_lane_blockage",
                    "possible_bus_stop_blockage",
                    "possible_double_parking",
                    "possible_delivery_activity",
                    "possible_bike_lane_blockage",
                    "unclear"
                  ]
                },
                vehicleType: {
                  type: "string",
                  enum: ["bus", "delivery_van", "box_truck", "passenger_car", "bike", "unknown"]
                },
                locationContext: {
                  type: "string",
                  enum: ["bus_lane", "bus_stop", "curb", "travel_lane", "bike_lane", "unknown"]
                },
                description: { type: "string" },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                humanReviewRequired: { type: "boolean" }
              },
              required: [
                "eventType",
                "vehicleType",
                "locationContext",
                "description",
                "confidence",
                "humanReviewRequired"
              ]
            }
          }
        }
      } as any);
      const outputText = (response as any).output_text as string | undefined;
      if (!outputText) return fallbackFinding(imagePath, "OpenAI response did not include output_text.");
      return VisionFindingSchema.parse({
        ...JSON.parse(outputText),
        evidencePath: imagePath,
        source: "openai_vision"
      });
    } catch (error) {
      return fallbackFinding(imagePath, `OpenAI vision analysis failed: ${String(error)}`);
    }
  }
}

function fallbackFinding(evidencePath: string, reason: string): VisionFinding {
  return {
    eventType: "unclear",
    vehicleType: "unknown",
    locationContext: "unknown",
    description: `${reason} Evidence requires human review.`,
    confidence: 0.2,
    humanReviewRequired: true,
    evidencePath,
    source: "fallback"
  };
}
