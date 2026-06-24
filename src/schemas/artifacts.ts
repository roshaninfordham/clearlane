import { z } from "zod";

export const ArtifactPathsSchema = z.object({
  reportMd: z.string(),
  reportPdf: z.string(),
  metricsJson: z.string(),
  routeHealthJson: z.string(),
  geojson: z.string(),
  recommendationsJson: z.string(),
  auditLog: z.string(),
  auditManifest: z.string()
});

export type ArtifactPaths = z.infer<typeof ArtifactPathsSchema>;
