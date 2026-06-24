import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { pathExists } from "./paths.js";
import { PACKAGE_NAME } from "./version.js";

export const ClearLaneConfigSchema = z.object({
  packageName: z.string().default(PACKAGE_NAME),
  outputDir: z.string().default("./output"),
  inputDir: z.string().default("./input"),
  evidenceDir: z.string().default("./input/evidence"),
  cacheDir: z.string().default(".clearlane/cache"),
  dataSources: z
    .object({
      mtaBusTime: z
        .object({
          enabled: z.boolean().default(true),
          apiKeyEnv: z.string().default("MTA_API_KEY")
        })
        .default({ enabled: true, apiKeyEnv: "MTA_API_KEY" }),
      nycOpenData: z
        .object({
          enabled: z.boolean().default(true),
          appTokenEnv: z.string().default("NYC_OPEN_DATA_APP_TOKEN")
        })
        .default({ enabled: true, appTokenEnv: "NYC_OPEN_DATA_APP_TOKEN" }),
      openaiVision: z
        .object({
          enabled: z.boolean().default(true),
          apiKeyEnv: z.string().default("OPENAI_API_KEY"),
          model: z.string().default("gpt-4.1-mini")
        })
        .default({ enabled: true, apiKeyEnv: "OPENAI_API_KEY", model: "gpt-4.1-mini" })
    })
    .default({
      mtaBusTime: { enabled: true, apiKeyEnv: "MTA_API_KEY" },
      nycOpenData: { enabled: true, appTokenEnv: "NYC_OPEN_DATA_APP_TOKEN" },
      openaiVision: { enabled: true, apiKeyEnv: "OPENAI_API_KEY", model: "gpt-4.1-mini" }
    }),
  datasets: z
    .object({
      mtaSegmentSpeeds: z.string().default("kufs-yh3x"),
      nyc311: z.string().default("erm2-nwe9"),
      nycBusLanes: z.string().default("ycrg-ses3"),
      mtaBusStops: z.string().optional(),
      mtaBusRoutes: z.string().optional()
    })
    .default({
      mtaSegmentSpeeds: "kufs-yh3x",
      nyc311: "erm2-nwe9",
      nycBusLanes: "ycrg-ses3"
    }),
  privacy: z
    .object({
      stripImageMetadata: z.boolean().default(true),
      blurFacesAndPlatesBestEffort: z.boolean().default(true),
      doNotIdentifyPeople: z.boolean().default(true)
    })
    .default({
      stripImageMetadata: true,
      blurFacesAndPlatesBestEffort: true,
      doNotIdentifyPeople: true
    }),
  audit: z
    .object({
      ledgerFile: z.string().default("audit-log.ndjson"),
      manifestFile: z.string().default("audit-manifest.json"),
      hashAlgorithm: z.literal("sha256").default("sha256")
    })
    .default({
      ledgerFile: "audit-log.ndjson",
      manifestFile: "audit-manifest.json",
      hashAlgorithm: "sha256"
    })
});

export type ClearLaneConfig = z.infer<typeof ClearLaneConfigSchema>;

export function defaultConfig(): ClearLaneConfig {
  return ClearLaneConfigSchema.parse({});
}

export async function loadConfig(cwd = process.cwd()): Promise<ClearLaneConfig> {
  const configPath = path.join(cwd, "clearlane.config.json");
  if (!(await pathExists(configPath))) return defaultConfig();
  const raw = JSON.parse(await readFile(configPath, "utf8")) as unknown;
  return ClearLaneConfigSchema.parse(raw);
}

export async function writeDefaultConfig(configPath = "clearlane.config.json"): Promise<void> {
  const content = `${JSON.stringify(defaultConfig(), null, 2)}\n`;
  await writeFile(configPath, content, { flag: "wx" });
}
