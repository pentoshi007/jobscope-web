# JobScope

AI-powered job aggregator. Upload a resume → get ranked matches across public job APIs plus LinkedIn via Apify → track applications → daily digest emails.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Better Auth · MongoDB Atlas · Cloudflare R2 · Gemini Flash + Groq · Resend · Vercel.

## Features

- Email/password + Google OAuth (Better Auth, MongoDB-native)
- Resume upload (PDF/DOCX) → R2 → text extract → Gemini-parsed JSON with PII redaction
- 8 job sources: LinkedIn via Apify, Remotive, Arbeitnow, The Muse, USAJobs, Adzuna, Jooble, JSearch
- Apify LinkedIn ingestion is guarded by a 15-day source cache so cron/admin flows do not refetch while fresh LinkedIn data exists
- Daily cron pulls + dedupes + skill-enriches every 24h
- Match scoring (skills 50 / seniority 20 / location 15 / experience 10 / recency 5)
- Dashboard with filters, search, ScoreDonut visualization
- Admin console for users, resumes, suggested cached jobs, platform stats, and deduped logs
- Job detail with breakdown radial + AI helpers (cover letter streaming, skill gap, interview prep)
- Application Kanban (`@dnd-kit`) with drag-persist
- Daily digest emails (React Email) with min-score threshold
- Settings: profile, preferences, account deletion (cascading)
- Dark mode, OWASP headers, rate limiting in proxy

## Local setup

```bash
pnpm install
cp .env.example .env  # fill in the keys
pnpm dev
```

Open <http://localhost:3000>.

### Required env vars

See `lib/env.ts` for the full Zod schema. Get free keys from:

| Service | Where |
| ------- | ----- |
| MongoDB Atlas M0 | <https://cloud.mongodb.com> |
| Google OAuth | <https://console.cloud.google.com/apis/credentials> |
| Gemini API | <https://aistudio.google.com/apikey> |
| Groq | <https://console.groq.com/keys> |
| Adzuna | <https://developer.adzuna.com> |
| Jooble | <https://jooble.org/api/about> |
| RapidAPI (JSearch) | <https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch> |
| Apify (optional LinkedIn source) | <https://console.apify.com/account/integrations> |
| Resend | <https://resend.com/api-keys> |
| Cloudflare R2 | <https://dash.cloudflare.com> |

Generate `AUTH_SECRET` and `CRON_SECRET` with `openssl rand -hex 32`.
Set `ADMIN_EMAILS` and `ADMIN_PASSWORD` for the separate `/admin` login prompt.

## Scripts

| Script | What |
| ------ | ---- |
| `pnpm dev` | Turbopack dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | Biome lint |
| `pnpm lint:fix` | Auto-fix |
| `pnpm test` | Vitest |
| `pnpm fetch-jobs` | Trigger ingestion locally |
| `pnpm send-alerts` | Trigger digest locally |

## Deploy to Vercel

1. Push to GitHub, import in Vercel.
2. Add all env vars from `lib/env.ts`.
3. In MongoDB Atlas, allowlist `0.0.0.0/0` (or Vercel's egress IPs).
4. In Google Cloud Console add `https://<your-domain>/api/auth/callback/google` to OAuth redirect URIs.
5. Verify the Resend sending domain.
6. Crons in `vercel.json` run automatically (21:30 UTC fetch, 03:30 UTC alerts ≈ 9am IST).

## Architecture

```
app/
  (auth)/            login, signup, verify, forgot-password
  (app)/             dashboard, jobs/[id], resumes, applications, settings, admin  (auth-gated)
  api/
    auth/[...all]    Better Auth handler
    cron/            fetch-jobs, send-alerts (Bearer CRON_SECRET)
    ai/              cover-letter (stream), skill-gap, interview-prep
lib/
  auth.ts            Better Auth config
  db.ts              Mongoose + native MongoClient share connection
  r2.ts              S3 client targeting R2
  llm/               gemini, groq, redact
  resume/            extract (pdf-parse + mammoth), parse, ats
  jobs/              ingest sources, adapters, dedupe, enrich, types
  match/score.ts     50/20/15/10/5 scoring
  email/             React Email digest template
models/              Mongoose schemas: Resume, Job, Application, Match
proxy.ts             Auth gate + per-IP API rate limit (60/min)
```

## Security

- Passwords hashed by Better Auth (scrypt).
- Email verification required before sign-in.
- All resume uploads validated (MIME + 5MB cap).
- PII redacted before any LLM call (`lib/llm/redact.ts`).
- Rate limit on `/api/*` (60/IP/min) and AI endpoints (10/user/min).
- Strict CSP-friendly security headers in `next.config.ts`.
- TTL index on `Job.cacheExpiresAt` purges stale jobs by source policy; Apify LinkedIn jobs are retained for 15 days to protect free-trial credits.
- Account delete cascades through Resume/Application/Match + R2 objects + auth tables.

## Acknowledgements

JobScope leans on the generous free tiers of MongoDB Atlas, Cloudflare R2, Vercel, Gemini, Groq, Resend, Apify, and the public job APIs above. Always free for users.
