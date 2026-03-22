# Changelog

All notable changes to **Landing Page Advisor** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [1.3.1] — 2026-03-22

### Fixed — Security Hardening (SAU-72, SAU-73)

**P0 (release-blocking)**
- `src/lib/scraper.ts` — SSRF mitigation: added `isPrivateHost()` blocklist rejecting localhost, 127.x, 169.254.x, 10.x, 172.16–31.x, 192.168.x, ::1 before any fetch
- `src/app/api/auth/request-otp/route.ts` — replaced `Math.random()` with `crypto.randomInt(100000, 1000000)` (CSPRNG)
- `src/app/api/bulk/route.ts` — switched `Promise.all` → `Promise.allSettled` for partial-failure handling; returns successful results even when some URLs fail

**P1 (should fix)**
- `src/app/api/auth/verify-otp/route.ts` — wrapped OTP verify + user upsert in `prisma.$transaction()` to eliminate race condition
- Session cookie — added `Secure` flag
- `src/app/api/results/route.ts` — added auth guard (session check) to prevent unauthenticated data injection
- `prisma/schema.prisma` — added DB indexes on `AnalysisResult.userId` and `.ip` for rate-limit query performance
- `src/lib/scraper.ts` — added 5 MB max content-length check to prevent OOM on oversized pages

**P2 (quality)**
- `src/lib/session.ts` — `SESSION_SECRET` now throws at startup in production if env var is missing
- `src/app/api/health/route.ts` — added `/api/health` endpoint for monitoring
- `src/lib/parse-json.ts` — deduplicated `parseJsonResponse` into shared utility (was duplicated in two files)
- `prisma/schema.prisma` — added `@@unique([slug, email])` constraint to `EmailCapture` model
- `src/components/SignInModal.tsx` — added `role="dialog"` and focus trap for ARIA compliance

### Added
- `src/lib/logger.ts` — structured JSON logger (replaces ad-hoc `console.log` calls across all API routes) (SAU-73)

---

## [1.3.0] — 2026-03-22

### Added — v1.3 Sprint (SAU-68–71)

- **PDF export** (SAU-68) — client-side PDF generation for analysis reports via `html2canvas` + `jsPDF`
- **Email-based OTP auth + analysis history** (SAU-69) — email OTP sign-in, session management, `/history` page with paginated past analyses
- **Bulk URL analysis** (SAU-70) — batch mode accepts 3–10 URLs, runs analyses in parallel, returns combined results with per-URL breakdown
- **Live PostHog integration** (SAU-71) — connect real PostHog project API key in settings; pulls live event data to enrich tracking recommendations

---

## [1.2.0] — 2026-03-22

### Added — v1.2 Sprint (SAU-61)

- **Competitive comparison mode** — dual URL input, two parallel 6-expert pipelines, side-by-side score cards with delta indicators, overall winner callout, shareable comparison link

---

## [1.1.0] — 2026-03-22

### Added — v1.1 Sprint + i18n (SAU-60, SAU-62–66)

- **Shareable report links** — server-side result persistence (SQLite + Prisma), nanoid slugs, `/r/{slug}` public read-only view, "Share this report" CTA (SAU-60)
- **Email capture** — optional "Email me this report" CTA on results + shared view (SAU-60)
- **Multi-language support** — EN / VI / DE with flag switcher (SAU-62)
- **Flag emojis** in `LanguageSwitcher` component (SAU-63)
- **Cookie persistence** for language preference (`NEXT_LOCALE`) (SAU-65)
- **Browser language auto-detect** via `Accept-Language` header on first visit (SAU-66)
- Product name `Landing Page Advisor` kept untranslated across all locales (SAU-64)

---

## [1.0.0] — 2026-03-22

### Added — MVP (SAU-57–58, SAU-61)

- **URL input form** — single input with `https://` auto-prepend and validation
- **HTML scraper** (`src/lib/scraper.ts`) — extracts title, meta tags, headings, CTA texts, form fields, body copy, DOM elements via `cheerio`
- **6-expert analysis pipeline** — parallel Claude calls across UI/Design, UX Research, Experiment Design, Content/Copy, SEO, Marketing Psychology
- **PostHog Tracking Advisor** — generates 8–15 tracking points with copy-paste JS snippets, key metrics, dashboard suggestions
- **Results dashboard** — overall score gauge, per-expert score strip, top priority actions, 6 `ExpertCard` components, `PostHogGuide`
- **Loading screen** — cycles through expert names every 4 s
- **AI provider abstraction** — Anthropic (`claude-sonnet-4-6`) default, OpenAI (`gpt-4o`) fallback
- `.gitignore`, `README.md`, `.env.example` for GitHub publish

---

[Unreleased]: https://github.com/SauNu84/landingpage_advisor/compare/v1.3.1...HEAD
[1.3.1]: https://github.com/SauNu84/landingpage_advisor/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/SauNu84/landingpage_advisor/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/SauNu84/landingpage_advisor/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/SauNu84/landingpage_advisor/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/SauNu84/landingpage_advisor/releases/tag/v1.0.0
