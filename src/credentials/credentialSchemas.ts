import { z } from "zod";

export const CREDENTIAL_NAMES = [
  "MTA_API_KEY",
  "NYC_OPEN_DATA_APP_TOKEN",
  "OPENAI_API_KEY",
  "NY511_API_KEY"
] as const;

export type CredentialName = (typeof CREDENTIAL_NAMES)[number];

export const CredentialSourceSchema = z.enum(["environment", "local-file", "project-env"]);
export type CredentialSource = z.infer<typeof CredentialSourceSchema>;

export const CredentialStatusSchema = z.object({
  present: z.boolean(),
  source: CredentialSourceSchema.nullable()
});

export type CredentialStatus = z.infer<typeof CredentialStatusSchema>;

export const AuthStatusSchema = z.object({
  configured: z.boolean(),
  credentials: z.record(z.enum(CREDENTIAL_NAMES), CredentialStatusSchema),
  capabilities: z.object({
    mtaRealtime: z.boolean(),
    nycOpenData: z.boolean(),
    visionEvidence: z.boolean(),
    cameraFeed: z.boolean(),
    mockMode: z.literal(true)
  })
});

export type AuthStatus = z.infer<typeof AuthStatusSchema>;

export const LocalCredentialValuesSchema = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  values: z.partialRecord(z.enum(CREDENTIAL_NAMES), z.string())
});

export type LocalCredentialValues = z.infer<typeof LocalCredentialValuesSchema>;

export const LocalCredentialMetadataSchema = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  credentials: z.partialRecord(
    z.enum(CREDENTIAL_NAMES),
    z.object({
      present: z.boolean(),
      storage: CredentialSourceSchema
    })
  )
});

export type LocalCredentialMetadata = z.infer<typeof LocalCredentialMetadataSchema>;
