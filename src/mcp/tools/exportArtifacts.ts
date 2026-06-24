import { z } from "zod";
import { readFile } from "node:fs/promises";

export const ExportArtifactsInputSchema = z.object({
  metricsPath: z.string().default("./output/metrics.json"),
  routeHealthPath: z.string().default("./output/route-health.json"),
  recommendationsPath: z.string().default("./output/recommendations.json")
});

export async function exportArtifactsTool(input: z.infer<typeof ExportArtifactsInputSchema>) {
  return {
    metrics: JSON.parse(await readFile(input.metricsPath, "utf8")) as unknown,
    routeHealth: JSON.parse(await readFile(input.routeHealthPath, "utf8")) as unknown,
    recommendations: JSON.parse(await readFile(input.recommendationsPath, "utf8")) as unknown
  };
}
