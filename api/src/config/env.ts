import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(28800),
  WEB_ORIGIN: z.url(),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_DOCS_ENABLED: z.stringbool().optional(),
  /** More browser origins allowed to call the API, comma-separated (for example the Expo web preview). */
  EXTRA_CORS_ORIGINS: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []))
    .pipe(z.array(z.url())),
  /** Optional contact (email or URL) sent to MusicBrainz, which throttles anonymous clients. */
  MUSICBRAINZ_CONTACT: z.string().trim().max(200).optional(),
});

export type Env = Omit<z.infer<typeof envSchema>, "API_DOCS_ENABLED" | "EXTRA_CORS_ORIGINS"> & {
  API_DOCS_ENABLED: boolean;
  /** WEB_ORIGIN plus EXTRA_CORS_ORIGINS. */
  CORS_ORIGINS: string[];
};

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.transform(({ EXTRA_CORS_ORIGINS, ...env }) => ({
    ...env,
    API_DOCS_ENABLED: env.API_DOCS_ENABLED ?? env.NODE_ENV !== "production",
    CORS_ORIGINS: [env.WEB_ORIGIN, ...EXTRA_CORS_ORIGINS],
  })).safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}

export const ENV = Symbol("ENV");
