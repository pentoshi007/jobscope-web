import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  AUTH_TRUST_HOST: z.string().optional(),
  CRON_SECRET: z.string().min(16),
  ADMIN_EMAILS: z.string().optional().default(""),
  ADMIN_PASSWORD: z.string().optional().default(""),

  GEMINI_API_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),

  ADZUNA_APP_ID: z.string().min(1),
  ADZUNA_APP_KEY: z.string().min(1),
  JOOBLE_API_KEY: z.string().min(1),
  RAPIDAPI_KEY: z.string().min(1),
  CAREERJET_API_KEY: z.string().optional(),
  INDIANAPI_JOBS_KEY: z.string().optional(),
  USAJOBS_API_KEY: z.string().optional(),
  USAJOBS_USER_AGENT: z.string().optional(),

  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ENDPOINT: z.string().url(),

  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
export type Env = typeof env;
