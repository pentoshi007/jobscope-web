# JobScope — Software Requirements Specification

> An AI-powered job aggregator. Users upload a resume; the system parses it, fans out to free public job APIs, scores matches, and surfaces the best fits on a modern dashboard.

**Document version:** 1.0 — April 2026
**Target build environment:** Next.js 16.2+, Node.js 22 LTS, MongoDB Atlas Free Tier
**Total recurring cost:** ₹0

---

## 1. Feasibility & Free-Tier Confirmation

| Concern | Verdict |
|---|---|
| Is this technically buildable? | Yes. All components are open-source or have generous free tiers. |
| Can it run free indefinitely? | Yes, for personal/portfolio scale (≤ ~5K MAU). |
| Can we sign in with email/password + Google? | Yes, via Auth.js v5 or Better Auth — both free, both support MongoDB. |
| Can we get real, fresh job data without paying? | Yes — aggregating Remotive, Arbeitnow, Adzuna, Jooble, The Muse, JSearch yields 10K+ live jobs including India. |
| The one limitation | LinkedIn / Indeed direct scraping is blocked & legally risky. We do **not** scrape them. We aggregate via licensed free APIs only. |

---

## 2. Tech Stack (latest stable, April 2026)

### Core
- **Next.js 16.2.4** — App Router, Server Actions, Turbopack (default), `proxy.ts` (renamed from `middleware.ts` in v16)
- **React 19**
- **TypeScript 5.6+**
- **Node.js 22 LTS** (minimum 20.9)

### Styling & UI
- **Tailwind CSS v4** (CSS-first config, no `tailwind.config.js` needed)
- **shadcn/ui** — copy-paste component primitives
- **Motion (formerly Framer Motion)** v12 — animations
- **Lucide React** — icons
- **Sonner** — toasts
- **Aceternity UI / Magic UI** — pull individual components for hero/cards/effects (free, MIT)
- **next-themes** — dark mode

### Auth
- **Better Auth v1** *(recommended)* — full data ownership, MongoDB-native, edge-compatible
  - *Fallback:* **Auth.js v5** + `@auth/mongodb-adapter` (still excellent; pick this if you want zero learning curve)
- Both support email/password (Credentials) + Google OAuth out of the box

### Database & Storage
- **MongoDB Atlas M0 (free)** — 512MB, shared cluster, no expiry
- **Mongoose v8** *(recommended)* or native MongoDB driver v6 — pick one and stay consistent
- **Cloudflare R2** for resume PDFs — 10GB free egress, S3-compatible
  - *Alternative:* UploadThing free tier (2GB) — easier setup if R2 feels heavy

### Resume Parsing
- **pdf-parse** or **pdfjs-dist** — extract raw text from uploaded PDFs (free, npm)
- **Google Gemini API (Flash)** — free tier: 15 RPM, 1M tokens/day in 2026 → use for structured extraction (skills, experience, education, seniority)
  - *Fallback:* **Groq API** (free) running Llama 3.3 70B — extremely fast
  - *Pure offline fallback:* **compromise.js** + a curated skills dictionary

### Job Aggregation (all free)
| Source | Auth | Coverage | Limit |
|---|---|---|---|
| Remotive | None | Remote, global | Unlimited, ~2K active |
| Arbeitnow | None | EU + remote | Unlimited |
| Adzuna | app_id + app_key | India + 19 countries, salary data | 250 calls/day/country |
| Jooble | API key (free) | Global incl. India | Generous |
| The Muse | None | US + tech | Unlimited |
| JSearch (RapidAPI) | API key (free) | LinkedIn/Indeed-sourced via license | 200/month free |
| USAJobs | None | US gov | Unlimited |

### Background Jobs
- **Vercel Cron** — free on Hobby plan, runs scheduled functions (`vercel.json`)
- *Alternative:* **Upstash QStash** free tier (500 messages/day) for delayed/queued tasks

### Hosting
- **Vercel Hobby** — free, includes CDN, edge functions, cron, analytics
- **MongoDB Atlas** — free cluster, deployed in same region (e.g., Mumbai/Bombay) for low latency

### Dev Tooling
- **Biome v2** *(recommended)* or ESLint + Prettier
- **pnpm** as package manager
- **Vitest** for unit tests
- **Playwright** for E2E

---

## 3. Functional Requirements

### 3.1 Authentication
- **FR-AUTH-1** Sign up with email + password (bcrypt-hashed, min 8 chars, complexity validation).
- **FR-AUTH-2** Sign up / sign in with Google OAuth.
- **FR-AUTH-3** Email verification on signup (magic-link via Resend free tier — 3K emails/month).
- **FR-AUTH-4** Forgot password flow (reset-link via email).
- **FR-AUTH-5** Persistent JWT sessions, 30-day expiry, refreshable.
- **FR-AUTH-6** Logout invalidates session token.
- **FR-AUTH-7** Protected routes via `proxy.ts` (Next.js 16 naming).

### 3.2 Resume Management
- **FR-RES-1** Upload PDF or DOCX (max 5MB), drag-and-drop UI.
- **FR-RES-2** Multiple resumes per user, each named (e.g., "Backend Resume", "ML Resume").
- **FR-RES-3** Mark one resume as "active" — drives default job matching.
- **FR-RES-4** Auto-parse on upload: extract name, email, phone, location, skills (categorized: languages / frameworks / tools / soft), experience (companies, roles, dates), education, certifications, total years of experience, inferred seniority (junior / mid / senior).
- **FR-RES-5** Show parsed result on a "Resume Profile" page with editable fields — user can correct mistakes.
- **FR-RES-6** Delete resume (soft delete; hard purge after 30 days).

### 3.3 Job Aggregation
- **FR-JOB-1** A daily cron job (03:00 IST) fetches from all configured sources.
- **FR-JOB-2** Normalize results into a unified `Job` schema (see §6).
- **FR-JOB-3** Deduplicate across sources by `(title + company + location)` hash.
- **FR-JOB-4** Tag each job with extracted skills (regex match against a skills dictionary + LLM enrichment for top 100 daily).
- **FR-JOB-5** Mark stale jobs (>30 days old) as expired, exclude from feeds.
- **FR-JOB-6** Manual "refresh feed" button on dashboard — rate-limited to once per hour per user.

### 3.4 Matching & Recommendations
- **FR-MATCH-1** For each user's active resume, compute a match score (0–100) for every job.
  - 50% — skill overlap (Jaccard + weighted by criticality)
  - 20% — seniority match
  - 15% — location match (remote / city / country)
  - 10% — experience years fit
  - 5% — recency boost (newer postings score slightly higher)
- **FR-MATCH-2** Rank jobs descending by score on the dashboard.
- **FR-MATCH-3** Show why a job matches — visualize matched skills (green pills) and missing skills (gray pills).
- **FR-MATCH-4** Filters: remote-only, location, seniority, posted within X days, salary range (where available), source.
- **FR-MATCH-5** Search bar with full-text search across title, company, description.

### 3.5 Application Tracker (Kanban)
- **FR-APP-1** Save a job → adds to "Saved" column.
- **FR-APP-2** Drag-drop columns: Saved → Applied → Interview → Offer → Rejected.
- **FR-APP-3** Per-card notes, application date, reminder date.
- **FR-APP-4** Stats widget: applications this week, response rate, avg time to response.

### 3.6 AI Helper Features (all use free Gemini/Groq tier)
- **FR-AI-1** Cover letter generator — given a job + active resume, draft a tailored cover letter.
- **FR-AI-2** Resume tailoring suggestions — "for this job, emphasize X, deemphasize Y."
- **FR-AI-3** Skill gap analysis — "you have 7/10 required skills; the missing 3 are [list], here are free resources."
- **FR-AI-4** Interview question prep — generate 10 likely questions for the role based on JD.
- **FR-AI-5** Resume ATS score — heuristic check (formatting, keyword density, contact info, action verbs).

### 3.7 Job Alerts
- **FR-ALERT-1** Daily digest email (Resend) at user-chosen time with top 5 new matches scoring ≥75.
- **FR-ALERT-2** Toggle alerts on/off in settings; choose frequency (daily / weekly / off).

### 3.8 User Settings
- Profile (name, avatar, default location, target roles, notice period).
- Preferences (preferred work modes, salary expectation, willing-to-relocate cities).
- Account (change password, delete account → GDPR-style data wipe).
- Connected accounts (Google).

---

## 4. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | First Contentful Paint ≤ 1.5s on 4G (use RSC, Turbopack, Vercel CDN). |
| NFR-2 | Time-to-Interactive ≤ 3s on dashboard. |
| NFR-3 | Lighthouse score ≥ 90 across Performance, Accessibility, Best Practices, SEO. |
| NFR-4 | Mobile-first responsive — fully usable on 360px viewports. |
| NFR-5 | WCAG 2.2 AA — keyboard navigation, focus rings, semantic HTML, aria labels. |
| NFR-6 | All API responses < 500ms p95 (excluding external job-API fetches which run in cron). |
| NFR-7 | Resume parsing complete within 8 seconds (with progress indicator). |
| NFR-8 | Zero PII leaks in logs; LLM calls strip email/phone before sending. |
| NFR-9 | Rate limiting on all public endpoints (Upstash Redis free tier or in-memory LRU for hobby scale). |
| NFR-10 | OWASP Top 10 hardened — CSRF tokens, XSS sanitization, SQL injection N/A (Mongo, but still validate), secure cookies, CSP headers. |

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Browser (React 19 + Tailwind v4)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js 16 App on Vercel Edge                  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │  RSC Pages   │ │ Server       │ │  Route Handlers    │  │
│  │  (dashboard, │ │ Actions      │ │  (/api/jobs,       │  │
│  │   resumes)   │ │ (upload,     │ │   /api/auth/*,     │  │
│  │              │ │  save job)   │ │   /api/cron/*)     │  │
│  └──────────────┘ └──────────────┘ └────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  proxy.ts — auth gating + rate limiting             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
       │                │                  │              │
       ▼                ▼                  ▼              ▼
┌─────────────┐  ┌────────────┐  ┌─────────────┐  ┌────────────┐
│  MongoDB    │  │ Cloudflare │  │  Gemini /   │  │ Job APIs   │
│  Atlas M0   │  │  R2        │  │  Groq LLM   │  │ (Remotive, │
│  (Mumbai)   │  │  (resumes) │  │             │  │  Adzuna…)  │
└─────────────┘  └────────────┘  └─────────────┘  └────────────┘
                              ▲
                              │
                ┌─────────────┴─────────────┐
                │   Vercel Cron (daily)     │
                │   /api/cron/fetch-jobs    │
                └───────────────────────────┘
```

---

## 6. Data Model (MongoDB / Mongoose schemas)

### `users`
```ts
{
  _id: ObjectId,
  email: String,                    // unique, indexed
  emailVerified: Date | null,
  passwordHash: String | null,      // null for Google-only users
  name: String,
  image: String | null,
  provider: 'credentials' | 'google',
  providerAccountId: String | null,
  createdAt: Date,
  updatedAt: Date,
  preferences: {
    targetRoles: [String],
    preferredLocations: [String],
    workMode: ['remote' | 'hybrid' | 'onsite'],
    minSalary: Number | null,
    currency: String,
    alertFrequency: 'daily' | 'weekly' | 'off',
    alertTime: String,              // "09:00"
    timezone: String,
  }
}
```

### `resumes`
```ts
{
  _id: ObjectId,
  userId: ObjectId,                 // indexed
  name: String,                     // "Backend Resume"
  isActive: Boolean,
  fileUrl: String,                  // R2 key
  rawText: String,
  parsed: {
    fullName: String,
    email: String,
    phone: String,
    location: String,
    summary: String,
    skills: {
      languages: [String],
      frameworks: [String],
      tools: [String],
      databases: [String],
      cloud: [String],
      soft: [String],
    },
    experience: [{
      company: String,
      role: String,
      startDate: String,
      endDate: String | 'Present',
      description: String,
      skills: [String],
    }],
    education: [{ school, degree, field, startDate, endDate }],
    certifications: [String],
    totalYearsExperience: Number,
    inferredSeniority: 'junior' | 'mid' | 'senior' | 'staff',
  },
  parsedAt: Date,
  createdAt: Date,
  deletedAt: Date | null,
}
```

### `jobs`
```ts
{
  _id: ObjectId,
  externalId: String,               // unique per source
  source: 'remotive' | 'arbeitnow' | 'adzuna' | 'jooble' | 'muse' | 'jsearch',
  dedupeHash: String,               // SHA-256 of (title|company|location)
  title: String,
  company: String,
  location: String,
  remote: Boolean,
  workMode: 'remote' | 'hybrid' | 'onsite',
  description: String,              // sanitized HTML or markdown
  url: String,
  postedAt: Date,
  expiresAt: Date,
  salary: {
    min: Number | null,
    max: Number | null,
    currency: String | null,
    period: 'year' | 'month' | 'hour' | null,
  },
  extractedSkills: [String],
  seniority: 'junior' | 'mid' | 'senior' | 'staff' | 'unknown',
  category: String,
  tags: [String],
  fetchedAt: Date,
}
// Indexes: externalId+source (unique), dedupeHash, postedAt, extractedSkills
```

### `applications` (Kanban cards)
```ts
{
  _id: ObjectId,
  userId: ObjectId,
  jobId: ObjectId,
  status: 'saved' | 'applied' | 'interview' | 'offer' | 'rejected',
  notes: String,
  appliedAt: Date | null,
  reminderAt: Date | null,
  matchScoreSnapshot: Number,
  createdAt: Date,
  updatedAt: Date,
}
```

### `matches` (cached daily; optional optimization)
```ts
{
  _id: ObjectId,
  userId: ObjectId,
  resumeId: ObjectId,
  jobId: ObjectId,
  score: Number,
  breakdown: {
    skills: Number,
    seniority: Number,
    location: Number,
    experience: Number,
    recency: Number,
  },
  matchedSkills: [String],
  missingSkills: [String],
  computedAt: Date,
}
// TTL index: 7 days
```

### Auth.js / Better Auth collections
Standard `accounts`, `sessions`, `verificationTokens` per the chosen library's adapter — don't redesign these.

---

## 7. API Endpoints

All endpoints are App Router route handlers under `/app/api/...`. Mutations should preferably use **Server Actions**, but list both for clarity.

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/[...all]` | Auth.js / Better Auth handler | — |
| POST | `/api/resumes/upload` | Upload + parse resume | Required |
| GET | `/api/resumes` | List user's resumes | Required |
| PATCH | `/api/resumes/:id` | Update parsed fields, set active | Required |
| DELETE | `/api/resumes/:id` | Soft delete | Required |
| GET | `/api/jobs` | Paginated, filtered job feed (with match scores) | Required |
| GET | `/api/jobs/:id` | Single job detail | Required |
| POST | `/api/applications` | Save / update application status | Required |
| GET | `/api/applications` | Get user's Kanban board | Required |
| POST | `/api/ai/cover-letter` | Generate cover letter | Required |
| POST | `/api/ai/skill-gap` | Skill gap analysis | Required |
| POST | `/api/ai/interview-prep` | Generate interview Qs | Required |
| GET | `/api/cron/fetch-jobs` | Daily aggregation (Vercel Cron) | Cron secret |
| GET | `/api/cron/send-alerts` | Daily digest emails | Cron secret |

**Conventions**
- All responses: `{ ok: boolean, data?, error? }`
- Pagination: `?page=1&limit=20`, response includes `total`, `hasMore`
- Validation: **Zod** schemas at the boundary, infer types
- Error codes: `UNAUTHORIZED`, `RATE_LIMITED`, `VALIDATION`, `NOT_FOUND`, `INTERNAL`

---

## 8. Resume Parsing Pipeline

1. User uploads PDF/DOCX via drag-drop component.
2. Server Action receives file → validates MIME + size → uploads to R2 → returns key.
3. Background-friendly processing (within request, since parsing is fast):
   - Extract raw text with `pdf-parse` (PDF) or `mammoth` (DOCX).
   - Strip emails/phones from text before sending to LLM.
   - Send to Gemini with strict JSON schema prompt:
     ```
     System: You are a resume parser. Output ONLY valid JSON matching this schema: { ... }.
     User: <resume text>
     ```
   - Validate response with Zod; if invalid, retry once with a stricter prompt; if still invalid, fall back to regex-based extraction.
4. Re-attach masked PII server-side, save to `resumes.parsed`.
5. Return parsed object to client; render editable form.

**Cost control:** average resume parse uses ~3K tokens. Free tier (1M tokens/day) supports ~330 parses/day — comfortably enough.

---

## 9. Job Aggregation Pipeline (cron)

```ts
// Pseudocode
async function fetchJobsCron() {
  const adapters = [remotiveAdapter, arbeitnowAdapter, adzunaAdapter, joobleAdapter, museAdapter, jsearchAdapter]

  for (const adapter of adapters) {
    try {
      const rawJobs = await adapter.fetch()
      const normalized = rawJobs.map(adapter.normalize) // → unified Job shape
      for (const job of normalized) {
        const dedupeHash = sha256(`${job.title}|${job.company}|${job.location}`.toLowerCase())
        await db.jobs.updateOne(
          { externalId: job.externalId, source: job.source },
          { $set: { ...job, dedupeHash, fetchedAt: new Date() } },
          { upsert: true }
        )
      }
    } catch (err) { logToSentry(err) /* don't fail entire cron */ }
  }

  // Skill enrichment for top 100 newest jobs without extractedSkills
  const newJobs = await db.jobs.find({ extractedSkills: { $size: 0 } }).limit(100).toArray()
  for (const job of newJobs) {
    job.extractedSkills = await extractSkillsLLM(job.description) // batched
    await db.jobs.updateOne({ _id: job._id }, { $set: { extractedSkills: job.extractedSkills } })
  }
}
```

Each adapter is a tiny module exporting `fetch()` and `normalize(raw)` — easy to add new sources.

---

## 10. Match Scoring Algorithm

```ts
function score(resume: ParsedResume, job: Job): MatchResult {
  // 1. Skills (50%)
  const resumeSkills = new Set([
    ...resume.skills.languages, ...resume.skills.frameworks,
    ...resume.skills.tools, ...resume.skills.databases, ...resume.skills.cloud
  ].map(s => s.toLowerCase()))
  const jobSkills = new Set(job.extractedSkills.map(s => s.toLowerCase()))
  const matched = [...jobSkills].filter(s => resumeSkills.has(s))
  const missing = [...jobSkills].filter(s => !resumeSkills.has(s))
  const skillScore = jobSkills.size === 0 ? 50 : (matched.length / jobSkills.size) * 50

  // 2. Seniority (20%)
  const seniorityScore = resume.inferredSeniority === job.seniority ? 20 :
    isAdjacent(resume.inferredSeniority, job.seniority) ? 12 : 4

  // 3. Location (15%)
  const locationScore =
    job.remote ? 15 :
    locationsMatch(resume.location, job.location, user.preferences.preferredLocations) ? 15 : 4

  // 4. Experience (10%)
  const expScore = experienceFit(resume.totalYearsExperience, job) // bell curve

  // 5. Recency (5%)
  const days = (Date.now() - job.postedAt.getTime()) / 86400000
  const recencyScore = Math.max(0, 5 - days * 0.1)

  return {
    score: Math.round(skillScore + seniorityScore + locationScore + expScore + recencyScore),
    matchedSkills: matched, missingSkills: missing,
    breakdown: { skills: skillScore, seniority: seniorityScore, location: locationScore, experience: expScore, recency: recencyScore }
  }
}
```

Scoring runs on-demand per page load (cached for 1 hour per user/resume in Redis or in-memory).

---

## 11. Auth Flow (Auth.js v5 with MongoDB)

```ts
// auth.config.ts (edge-safe)
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
export default { providers: [Google, Credentials({ /* ... */ })] }

// auth.ts (Node-only — adapter goes here)
import NextAuth from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import client from "@/lib/db"
import authConfig from "./auth.config"
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(client),
  session: { strategy: "jwt" }, // required for edge proxy.ts
  ...authConfig,
})

// proxy.ts (Next.js 16 — note: NOT middleware.ts)
import NextAuth from "next-auth"
import authConfig from "./auth.config"
export default NextAuth(authConfig).auth
export const config = { matcher: ["/dashboard/:path*", "/resumes/:path*", "/applications/:path*"] }
```

> If choosing **Better Auth** instead, follow its quickstart — pattern is similar but with `betterAuth({ database: mongodbAdapter(client) })`.

---

## 12. UI / UX Design System

### Vibe
**"Linear meets Notion meets Vercel"** — calm, dense, type-driven, very few colors, motion is subtle and meaningful.

### Tokens (Tailwind v4 CSS variables)
```css
@theme {
  --color-bg: oklch(0.99 0 0);
  --color-bg-subtle: oklch(0.97 0 0);
  --color-fg: oklch(0.15 0 0);
  --color-fg-muted: oklch(0.45 0 0);
  --color-border: oklch(0.92 0 0);
  --color-accent: oklch(0.65 0.18 260);  /* electric indigo */
  --color-success: oklch(0.7 0.17 145);
  --color-warning: oklch(0.78 0.15 75);
  --color-danger: oklch(0.62 0.22 25);
  --radius-card: 12px;
  --shadow-soft: 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.06);
}
@media (prefers-color-scheme: dark) {
  @theme { --color-bg: oklch(0.13 0 0); --color-fg: oklch(0.96 0 0); /* ... */ }
}
```

### Typography
- **Display:** Geist (or Inter Tight)
- **Body:** Geist
- **Mono:** Geist Mono (for skill chips, code)
- Scale: 12 / 14 / 16 / 18 / 24 / 32 / 48

### Components
- **JobCard** — title, company, location, salary range, top 5 skill chips (matched green / missing gray), match score donut, save/dismiss/apply buttons.
- **ScoreDonut** — animated SVG ring, color shifts green→amber→red.
- **SkillChip** — small pill, monospace, hover tooltip.
- **KanbanColumn** — soft border, drop highlight using Motion layoutId for smooth drags.
- **ResumeUploader** — drag-drop area, animated dashed border, preview thumbnail.
- **CommandPalette** — ⌘K, jumps to any job/page (cmdk lib).
- **SidebarNav** — collapsible, active state with subtle background pill.

### Motion principles
- Page transitions: 200ms ease, fade + 4px y-translate.
- List items: stagger 30ms.
- Drag handles in Kanban: spring `{ stiffness: 300, damping: 30 }`.
- Never animate things that don't need it. Loading spinners are pulse-only.

---

## 13. Pages & Routes

```
app/
  (marketing)/
    page.tsx                  # landing
    pricing/page.tsx          # "Always free" page
  (auth)/
    login/page.tsx
    signup/page.tsx
    verify/page.tsx
    forgot-password/page.tsx
  (app)/
    dashboard/page.tsx        # ranked jobs, match scores, filters
    jobs/[id]/page.tsx        # job detail + AI helpers
    resumes/page.tsx          # list + upload
    resumes/[id]/page.tsx     # parsed view, editable
    applications/page.tsx     # Kanban
    settings/
      profile/page.tsx
      preferences/page.tsx
      account/page.tsx
  api/
    auth/[...all]/route.ts
    resumes/...
    jobs/...
    applications/...
    ai/...
    cron/
      fetch-jobs/route.ts
      send-alerts/route.ts
  proxy.ts                    # auth + rate limit
  layout.tsx
  globals.css
```

---

## 14. Environment Variables

```bash
# Database
MONGODB_URI=mongodb+srv://...

# Auth
AUTH_SECRET=                      # openssl rand -base64 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_TRUST_HOST=true              # for Vercel

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=jobscope-resumes
R2_PUBLIC_URL=

# LLM
GEMINI_API_KEY=
GROQ_API_KEY=                     # fallback

# Job APIs
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
JOOBLE_API_KEY=
RAPIDAPI_KEY=                     # for JSearch

# Email
RESEND_API_KEY=

# Cron
CRON_SECRET=                      # openssl rand -hex 32

# Public
NEXT_PUBLIC_APP_URL=https://jobscope.vercel.app
```

---

## 15. Build Phases / Milestones

### Phase 1 — Foundation (Days 1–3)
- Scaffold with `pnpm create next-app@latest`
- Configure Tailwind v4, shadcn/ui, theme tokens
- Set up MongoDB connection, base Mongoose models
- Auth.js v5 with email/password + Google
- Basic layouts, sidebar, login/signup pages

### Phase 2 — Resume Pipeline (Days 4–6)
- R2 upload Server Action
- pdf-parse text extraction
- Gemini parsing with Zod validation
- Resume list, detail (editable), set-active

### Phase 3 — Job Ingestion (Days 7–9)
- Implement adapter for each source (Remotive first — easiest)
- Cron route handler + `vercel.json`
- Skill enrichment pass
- Manual run via dev endpoint, verify dedup works

### Phase 4 — Matching & Dashboard (Days 10–12)
- Match scoring algorithm
- Dashboard with filters, search, pagination
- JobCard + ScoreDonut polish
- Job detail page

### Phase 5 — Tracker & AI (Days 13–15)
- Application Kanban (use `@dnd-kit/core`)
- Cover letter generator
- Skill gap, interview prep
- ATS resume score

### Phase 6 — Alerts & Polish (Days 16–18)
- Daily digest cron + Resend templates
- Settings pages
- Empty states, error boundaries, loading skeletons
- Lighthouse pass, a11y audit

### Phase 7 — Ship (Day 19+)
- Vercel deploy, custom domain
- MongoDB Atlas IP allowlist (0.0.0.0/0 for Vercel)
- Monitoring (Vercel Analytics + Sentry free tier)
- README + onboarding

---

## 16. Acceptance Criteria

The build is considered complete when:

1. ✅ A new user can sign up via email or Google, verify email, log in, log out.
2. ✅ Uploading a real resume produces a parsed profile within 8 seconds, ≥90% field accuracy on a manual sample of 10 resumes.
3. ✅ The dashboard shows ≥500 unique, deduplicated, non-expired jobs from at least 4 sources within 24 hours of first cron run.
4. ✅ Match scores are displayed and feel reasonable on a manual review of 20 jobs.
5. ✅ Filters and search work and persist via URL params.
6. ✅ Kanban drag-drop persists status changes.
7. ✅ Cover letter generation returns a coherent letter in <10 seconds.
8. ✅ Daily digest email arrives at the user's chosen time with 5 matches.
9. ✅ Lighthouse: Performance ≥90, Accessibility ≥95 on dashboard + landing.
10. ✅ Total monthly recurring cost remains ₹0 at < 1K MAU.

---

## 17. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Free job APIs add coverage gaps for India | Adzuna `country=in` + Jooble both index Indian listings; supplement with manual RSS feeds (Naukri RSS is public). |
| Gemini free tier rate limit hit | Fall back to Groq; cache parsed resumes; batch requests. |
| MongoDB Atlas 512MB fills up | Add TTL on `jobs` collection (45 days); only enrich top jobs with skills. |
| Vercel cron limits on Hobby (1/day, 60s timeout) | Split fetch across multiple cron jobs by source; or move to Upstash QStash. |
| Email/password compromised credentials | Enforce strong passwords, optional TOTP later, monitor failed-login rate. |
| Resume PII in LLM logs | Strip email/phone before LLM; use Gemini's `dataIsolation` flag. |

---

## 18. Out of Scope (v1)

- Recruiter / employer side — this is candidate-only.
- Direct applying via API to jobs — always link out to source.
- Mobile native apps (PWA only).
- Payments, subscriptions — product is and stays free.
- LinkedIn / Indeed scraping — off-limits for legal & ToS reasons.

---

## 19. Glossary

- **ATS** — Applicant Tracking System; what big companies use to filter resumes.
- **JD** — Job Description.
- **MAU** — Monthly Active Users.
- **PII** — Personally Identifiable Information.
- **RSC** — React Server Components.

---

*End of document. Hand this file to your AI coder along with the relevant Auth.js / Next.js docs URLs and start at Phase 1.*
