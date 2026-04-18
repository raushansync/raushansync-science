# System Architecture

This document is the detailed technical architecture reference for the RaushanSYNC Science website.

Production host: science.raushansync.com

Canonical architecture scope:
- Static multi-page frontend application
- Supabase-based authentication and persistence
- Cloudflare Worker backed AI assistant
- PWA caching and offline support
- Dashboard, progress, and quiz score subsystems

This file is intentionally much more detailed than README.md. README.md should remain concise and onboarding-focused, while this file is implementation-focused.

## 1. Purpose and Design Goals

Primary product goals:
- Deliver science learning content with very low latency and minimal client overhead.
- Keep infrastructure simple (static pages + serverless backend edges).
- Support authentication, per-user progress tracking, and practice scoring.
- Provide a contextual AI tutor for quiz support and student-support mode.
- Work reasonably well under poor connectivity via service worker caching.

Non-goals:
- No SPA router framework.
- No heavy build pipeline for frontend runtime.
- No server-rendered dynamic HTML tier.

## 2. System Context

Major runtime actors:
- Browser client (HTML/CSS/JavaScript, service worker, local storage, fetch APIs)
- Static hosting layer for site assets and pages (as documented by repository structure)
- Cloudflare edge for worker runtime and domain edge concerns
- Supabase (Auth + Postgres + RLS)
- Groq API (LLM inference)

High-level data boundaries:
- Public static content: delivered as static files.
- Auth/session: browser receives Supabase session token.
- Protected data: persisted in Supabase with RLS constraints.
- AI request path: browser -> Cloudflare Worker -> Groq (with Supabase token verification in worker).

## 3. Production Topology

Production domain:
- CNAME points to science.raushansync.com.

Operationally relevant config:
- Worker name: quiz-ai-tutor
- Worker entry: worker.js
- Worker compatibility date: 2026-04-15
- Worker vars include SUPABASE_URL and SUPABASE_ANON_KEY
- GROQ_API_KEY is expected as a worker secret

Deployment shape:
- Static assets and pages are deployed from repository root structure.
- AI backend logic is deployed separately via Wrangler to Cloudflare Workers.

## 4. Repository Architecture

Top-level content domains:
- Root pages: index.html, login.html, signup.html, dashboard.html, and auxiliary auth pages.
- Content pages: notes, practice, practice-advanced, practice-solution, video-lessons.
- Shared UI fragments: components/nav.html, components/footer.html, components/support-cta.html.
- Shared frontend runtime: assets/js and assets/css.
- Worker runtime: worker.js + wrangler.jsonc.
- Data schema: database/schema.sql.
- PWA artifacts: service-worker.js + manifest.json + offline.html.
- CI/checks: .github/workflows/smoke.yml and scripts/validate-core-assets.mjs.

Important JavaScript modules and responsibilities:
- assets/js/auth-config.js
  - Supabase client initialization
  - Session lifecycle helpers
  - Redirect safety helpers
  - profile synchronization helpers
  - auth state event dispatch
- assets/js/auth-guard.js
  - route protection and auth-page redirection guard
  - auth-pending/auth-ready gating behavior
- assets/js/script.js
  - global UI behavior (theme, nav, component injection)
  - service worker registration
  - progress tick bootstrap and rebootstrap hooks
- assets/js/progress-tracker.js
  - read/write APIs for progress and practice_scores
  - stats aggregation helpers
- assets/js/tick-manager.js
  - UI tick creation, toggle behavior, and state sync
- assets/js/quiz-score-handler.js
  - score computation and persistence glue for quiz pages
- ai-chat.js
  - AI modal state machine, request execution, markdown rendering
- worker.js
  - origin checks, auth verification, rate limiting, Groq orchestration

## 5. Runtime Initialization and Script Contract

A typical protected content page loads scripts in this order:
1. Supabase CDN script
2. auth-config.js
3. optional progress-tracker.js and tick-manager.js
4. script.js
5. auth-guard.js
6. ai-chat.js when AI chat is enabled on page

Why ordering matters:
- auth-config.js must run before modules calling window.getCurrentSession and auth helpers.
- auth-guard.js should execute after auth-config.js so it can await window.whenAuthReady.
- script.js can bootstrap nav/footer/components and optionally initialize progress/ticks once auth is ready.

Initial auth paint behavior:
- auth-pending class is added early to hide page content until auth state resolves.
- auth-guard.js waits for session state, then either redirects or marks auth-ready.
- timeout fallback adds auth-error if auth check does not complete in expected time window.

## 6. Navigation and Shared Layout Composition

Component composition model:
- script.js dynamically fetches and injects reusable HTML fragments from /components.
- It attempts absolute path first, then relative fallbacks based on path depth.
- After injection, it re-runs nav setup and active-link highlighting.

Global UI interactions managed in script.js:
- dark mode state persisted in localStorage
- browser theme-color meta synced to current CSS primary color
- mobile/hamburger navigation behavior
- auto-hide header behavior on downward scroll
- bfcache-friendly reinitialization via pageshow

## 7. Authentication and Session Architecture

Auth provider:
- Supabase Auth with persisted session and token auto-refresh.

Client auth state contract:
- window.authState mirrors initialized/session status.
- window.whenAuthReady returns a promise resolved exactly once.
- rs:auth-state-change custom event is emitted on session transitions.

Protected-route policy (frontend):
- Protected prefixes include /dashboard.html, /practice/, /practice-advanced/.
- Any path containing /practice (except /practice-solution) is treated as protected.
- Unauthenticated users are redirected to login with a safe redirect query param.

Safe redirect design:
- Redirect targets are normalized to same-origin paths only.
- Auth routes can be blocked as redirect targets unless explicitly allowed.
- This mitigates open redirect abuse.

Sign-out behavior:
- auth signOut via Supabase
- sensitive same-origin documents are removed from caches API where applicable
- user is redirected to login with message=signed-out

## 8. Data Model and Persistence Contracts

Database tables (from database/schema.sql):
- profiles
  - primary key id references auth.users(id)
  - full_name, education_level, phone
- progress
  - key fields: user_id, site, item_path, item_type, completed, updated_at
  - unique: (user_id, site, item_path)
  - item_type constrained to article or practice
- practice_scores
  - key fields: user_id, site, practice_path, score, updated_at
  - unique: (user_id, site, practice_path)
  - score constrained to 0..100

RLS model:
- RLS enabled on all three tables.
- Policies ensure users can only select/insert/update/delete their own rows (auth.uid() = id/user_id).

Indexing model:
- progress indexes for user_id and common filter combinations
- practice_scores indexes for user_id and site combinations

Update timestamp model:
- Trigger function updates updated_at on table updates.

Profile bootstrap model:
- Trigger on auth.users insert creates/updates corresponding profiles row.

## 9. Site and Path Identity Model

The app uses a site key and normalized path strategy:
- Site identity is derived from hostname.
- Production hostnames containing raushansync.com are used directly.
- Localhost/127.0.0.1 and pages preview hostnames are normalized to science.raushansync.com for consistency.

Path normalization:
- Uses same-origin URL normalization.
- Stores pathname + search + hash with length bounds.
- Prevents cross-origin path pollution in persisted progress keys.

## 10. Progress Tick System Architecture

Core modules:
- progress-tracker.js handles persistence APIs.
- tick-manager.js handles UI and user interactions.

Tick semantics:
- completed: green-like visual state with check symbol
- incomplete: blue-like visual state with hollow symbol
- loading and error transitional states

Tick initialization:
- Containers are discovered by [data-tick-container].
- For each container, the manager computes site/path/itemType and creates button element.
- Existing persisted progress is fetched and reflected in state.
- Initialization is idempotent via data markers and in-memory map cache.

Tick toggle flow:
1. User clicks tick.
2. If not authenticated, redirect to login with return target.
3. Set loading state.
4. Toggle persisted progress using upsert.
5. Read final state and update UI.
6. Trigger dashboard updates when available.

Event and lifecycle handling:
- Ticks are cleared from cache on auth logout event.
- Multiple reinitializations are guarded to avoid duplicate elements/listeners.

## 11. Quiz and Score Persistence Architecture

quiz-score-handler.js responsibilities:
- Detects quiz cards and answer keys via data-answer attributes.
- Tracks answered and correct card indices.
- Computes score as rounded percentage.
- Renders score card in-page.

Persistence after submit:
- Saves practice score to practice_scores (upsert by user_id, site, practice_path).
- Marks current item as completed in progress table.
- Runs both operations with Promise.all and independent error handling.

Current scoring model:
- Most recent score per practice path is retained in practice_scores due unique key.
- Historical per-attempt analytics are not retained in current schema.

## 12. Dashboard Architecture

Dashboard data surfaces:
- Profile card: full_name, email, education_level, phone.
- Progress counters:
  - completed articles (progress rows with item_type=article and completed=true)
  - completed practices (progress rows with item_type=practice and completed=true)
- Recent activity palettes:
  - recent completed article paths
  - recent completed practice paths

Dashboard edit profile behavior:
- Modal form updates auth metadata and syncs profiles row.
- Validation includes required full name, email, education level, and phone constraints.
- UI updates are applied after successful writes.

Dashboard AI mode:
- Dashboard button opens AI modal in student-support mode.
- Context payload is generic student support context rather than quiz-specific context.

## 13. AI Assistant Architecture

### 13.1 Client-side AI runtime (ai-chat.js)

Client responsibilities:
- modal UI lifecycle and state
- assistant history buffer
- context packaging
- markdown rendering for assistant messages
- origin-side precheck for allowed browsing contexts
- session token extraction from auth helpers

Request contract from client to worker:
- Method: POST
- Headers:
  - Content-Type: application/json
  - Authorization: Bearer <supabase_access_token>
- Body:
  - message
  - context
  - history (last 10)
  - mode

Failure UX model:
- Network-level failures produce "Unable to reach the AI service..." message.
- HTTP failures parse response JSON and show structured provider/status message.

### 13.2 Worker runtime (worker.js)

Allowed origins:
- exact production origin: https://science.raushansync.com
- local development origins with http protocol and host localhost or 127.0.0.1

CORS model:
- OPTIONS and POST only
- Access-Control-Allow-Headers includes Content-Type and Authorization
- Vary: Origin

Auth model:
- Bearer token required
- token verified by calling Supabase /auth/v1/user endpoint with anon key
- unauthorized returns 401 with WWW-Authenticate header

Rate limiting model:
- In-memory per-isolate map keyed by userId:clientIp
- window: 60 seconds
- max requests: 20 per window
- over-limit response: 429 with Retry-After

Prompt construction model:
- system prompt differs by mode:
  - quiz-assistant
  - student-support
- contextual system prompt includes topic/question/user answer/correct answer/explanation/page URL
- history from client is normalized and trimmed

Model routing model:
- model selection normalized against allowlist
- default model: llama-3.1-8b-instant
- fallback model: qwen/qwen3-32b when default receives 429

Upstream behavior:
- calls Groq chat completions endpoint
- temperature and token caps configured in worker payload
- upstream non-200 responses are sanitized before returning to client

Security posture of AI path:
- Browser never receives GROQ_API_KEY.
- Worker enforces origin + token verification + rate limiting.
- Client receives sanitized error messages, reducing leakage.

## 14. Service Worker and PWA Architecture

Manifest:
- standalone display with icon set and theme colors
- app identity configured for installable PWA behavior

Service worker cache model:
- CORE_CACHE and RUNTIME_CACHE names versioned by CACHE_VERSION
- CORE_ASSETS pre-cached during install
- old cache cleanup on activate

Routing strategy matrix:
- Sensitive document routes (auth pages + protected pages): network-only, no-store
- Other documents: network-first with cached fallback
- Static assets/components/content paths: cache-first
- Offline fallback: /offline.html for document fetch failures

Runtime cache control:
- runtime cache trimmed recursively to MAX_RUNTIME_ENTRIES

Security-sensitive caching decision:
- auth and protected documents are intentionally excluded from persistent offline serving to reduce stale or sensitive content persistence risks.

## 15. CI and Quality Gates

Current CI workflow:
- GitHub Actions workflow: Smoke Checks
- triggers on push and pull_request
- Node.js 22
- npm ci
- npm test

Smoke tests (package.json):
- syntax check for ai-chat.js and service-worker.js
- integrity check for service-worker CORE_ASSETS list via scripts/validate-core-assets.mjs

CORE_ASSETS validator behavior:
- Parses CORE_ASSETS from service-worker.js
- Normalizes '/' to '/index.html' and trailing slash paths to index.html
- Fails build if any referenced file is missing

## 16. Deployment and Operations Runbook

Static site release:
- commit and push repository changes to static host pipeline.

Worker release:
- npx wrangler deploy
- verify endpoint health and CORS preflight from localhost and production origins

Recommended post-deploy checks:
1. npm test
2. npx wrangler deploy --dry-run for validation before real deploy
3. npx wrangler deploy for production worker rollout
4. OPTIONS preflight check to verify Authorization in Access-Control-Allow-Headers
5. Signed-in browser flow test for AI chat

## 17. Security Architecture Summary

Controls currently implemented:
- frontend auth guard for protected routes
- safe redirect path validation
- Supabase RLS ownership isolation
- worker-side origin allowlist and token verification
- worker-side per-user+ip rate limiting
- sanitized upstream AI failure responses
- limited/no-store caching policy on sensitive documents

Risk notes:
- Supabase anon key is intentionally public but should be scoped by strict RLS (already used).
- In-memory worker rate limit is isolate-local, not globally distributed. It is still valuable, but not a full distributed abuse prevention control.
- CSP and SRI are not comprehensively documented as enforced across all pages yet.

## 18. Performance Architecture

Performance characteristics by design:
- No frontend framework hydration cost.
- Static HTML delivery with reusable shared script modules.
- Component HTML fetched on demand but cached by service worker and edge.
- Cache-first for most static assets and learning content.
- Network-first for non-sensitive document freshness.
- Edge worker near-user request handling for AI API orchestration.

Potential bottlenecks:
- Large page-specific inline scripts in some practice pages increase parse/execute time.
- Repeated per-page script blocks may increase maintenance overhead.
- Runtime cache trimming recursion is simple and effective at current scale but not LRU-optimized.

## 19. Reliability and Failure Modes

Observed/expected failure classes and behavior:
- Missing session token:
  - AI call fails with explicit sign-in guidance.
- Worker unreachable/CORS/network failure:
  - AI modal shows network guidance message.
- Worker rejects origin:
  - 403 Forbidden from worker.
- Supabase auth verification unavailable in worker:
  - 503 Authentication service unavailable.
- Groq unavailable/upstream errors:
  - 502 AI service unavailable with sanitized message.
- Offline document fetch:
  - fallback to offline.html where appropriate.

## 20. Architecture Tradeoffs

Why this architecture works well for this platform:
- Static-first model is easy to host, cache, and scale.
- Vanilla stack keeps client footprint small.
- Supabase covers auth and persistence without custom backend servers.
- Worker isolates secrets and adds policy enforcement for AI calls.
- PWA cache model improves resilience for content-heavy educational pages.

Tradeoffs accepted:
- More manual script coordination versus framework conventions.
- More per-page wiring effort for interactive practice experiences.
- Worker/API operational path requires explicit deploy synchronization with repo changes.

## 21. Documentation Strategy (README vs ARCHITECTURE)

Good practice guidance:
- README.md should remain concise:
  - what the project is
  - how to run locally
  - key commands
  - where to find deeper docs
- ARCHITECTURE.md should remain the detailed, source-of-truth technical design and runtime behavior document.

Current state:
- README.md already follows this pattern by linking to ARCHITECTURE.md.
- This document is the deep technical reference and should be updated whenever runtime contracts, schema, or deployment flows change.

## 22. Future Improvements Roadmap

Suggested next architecture upgrades:
1. Add strict CSP and optional nonces/hashes across pages.
2. Add SRI for third-party CDN scripts where feasible.
3. Introduce distributed rate limiting or bot mitigation for worker endpoint.
4. Consolidate duplicated per-practice inline scripts into reusable modules.
5. Add integration tests for auth redirect flow and AI request flow.
6. Add synthetic monitoring for worker and key pages on science.raushansync.com.

## 23. Quick Reference

Production domain:
- https://science.raushansync.com

AI worker endpoint:
- https://quiz-ai-tutor.raushanguptaicloud.workers.dev/

Critical local commands:
- npm test
- npx wrangler deploy --dry-run
- npx wrangler deploy

Critical runtime files:
- worker.js
- ai-chat.js
- service-worker.js
- assets/js/auth-config.js
- assets/js/auth-guard.js
- assets/js/progress-tracker.js
- assets/js/tick-manager.js
- assets/js/quiz-score-handler.js
- database/schema.sql
