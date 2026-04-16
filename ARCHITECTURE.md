# 🏗️ System Architecture Document

This document provides a comprehensive, super-detailed overview of the technological implementation, architecture, and core logic of the platform.

## 🏛️ 1. High-Level Architecture Overview

The system is a static-first, highly dynamic client-side application designed for maximum performance, offline capability, and seamless user experience. 

### Core Tech Stack
- **Hosting:** GitHub Pages (Static file hosting)
- **CDN & DNS:** Cloudflare (Edge caching, SSL, DDoS protection)
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, Authentication)
- **AI Services:** Groq API (High-speed inference for AI chat/responses)
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (No heavy frameworks for optimal performance)

---

## ☁️ 2. Infrastructure & Delivery

### GitHub Pages & Cloudflare Integration
- **GitHub Pages:** Serves as the origin server. All static assets (HTML, CSS, JS, Images) are deployed here.
- **Cloudflare (CDN / DNS):** Sits in front of GitHub Pages. 
  - **DNS Resolution:** Manages custom domain routing (`CNAME`).
  - **Edge Caching:** Caches static assets at edge nodes globally, reducing latency and origin load.
  - **Security:** Enforces strict HTTPS and provides web application firewall (WAF) rules.

---

## 🗄️ 3. Database & Backend (Supabase)

Since the application is static-first, backend interactions are handled strictly via client-side API calls to Supabase.
- **Authentication:** Managed via Supabase Auth (JWT tokens). Scripts like `auth-config.js` and `auth-guard.js` intercept routing to protect private routes.
- **Data Storage:** Uses Supabase's PostgreSQL database to store user profiles, progress data, and quiz scores.
- **Security (RLS):** Row Level Security ensures users can only read/write their own progress and data.

---

## 🤖 4. AI Chat Integration (Groq API)

The platform features an AI assistant powered by the Groq API (handled in `ai-chat.js`).
- **Inference Engine:** Uses Groq's high-speed inference for near-instantaneous responses.
- **Client-Side Orchestration:** The frontend manages the prompt context, captures user input, and securely communicates with an intermediary worker (e.g., Cloudflare Worker defined in `worker.js` or `wrangler.jsonc`) to keep API keys hidden from the client, before reaching the Groq API.

---

## ✨ 5. Core Feature Specifications

### 🧩 5.1 Dynamic Insertion of Elements
To keep the application DRY (Don't Repeat Yourself) without a build step or framework, UI components like the Navbar, Footer, and Support CTAs are loaded dynamically.
- **Mechanism:** The system uses the JavaScript `fetch()` API to retrieve global components from the `/components/` folder (e.g., `nav.html`, `footer.html`).
- **DOM Injection:** Once fetched, the raw HTML is parsed and injected into placeholder `<div>` tags (e.g., `<div id="nav-placeholder"></div>`) via `innerHTML`.
- **Event Reattachment:** After insertion, custom events and active link states are dynamically calculated based on `window.location.pathname` so the correct menu item is highlighted.

### 📝 5.2 Quiz Logic (`quiz-score-handler.js`)
The quiz system is completely client-side, designed to be fault-tolerant and responsive.
- **State Management:** Quiz state (current question, selected options, score) is kept in memory and backed up to `localStorage` to survive accidental page reloads.
- **Rendering:** Questions and options are dynamically rendered via JavaScript templating.
- **Validation:** When a user selects an option, the system evaluates the answer against the correct option. Immediate feedback (visual cues) is provided.
- **Score Calculation:** Managed by `quiz-score-handler.js`. It aggregates points, calculates percentages, and determines pass/fail thresholds.
- **Result Submission:** Upon completion, the final score payload is formatted and sent to Supabase. If the user is offline, it queues the result in `localStorage` to be synced later.

### 📈 5.3 Progress Tracking (`progress-tracker.js` & `tick-manager.js`)
Progress tracking is crucial for the learning experience, tracking chapters read, videos watched, and quizzes completed.
- **Hybrid Storage Strategy:**
  1. **Local State (`localStorage`):** Optimistic UI updates. When a user completes a lesson, it's instantly marked as complete locally (managed by `tick-manager.js`).
  2. **Remote Sync (Supabase):** `progress-tracker.js` acts as an orchestrator. It listens for completion events, updates the UI, and debounces an API call to Supabase to persist the state permanently in the database.
- **Conflict Resolution:** On login, the system pulls the master state from Supabase and overwrites/merges the local state to ensure consistency across devices.

### ⚡ 5.4 Advanced Caching & Offline Capabilities
The app is designed as a Progressive Web App (PWA) using `service-worker.js`.
- **Service Worker Lifecycle:**
  - **Install Phase:** Pre-caches critical assets (core CSS, JS, `index.html`, and `offline.html`).
  - **Activate Phase:** Cleans up stale caches from previous versions.
- **Caching Strategies:**
  - **Cache First, Network Fallback:** Used for static assets (images, fonts, CSS). It checks the cache first; if missing, it fetches and caches it.
  - **Network First, Cache Fallback:** Used for HTML pages and Supabase API GET requests. It ensures the user gets the freshest data, prioritizing the network but falling back to the cache if offline.
- **Offline Mode:** If an explicit page is not cached and the user is offline, the service worker intercepts the failed network request and serves `offline.html`.

## 🔒 6. Security Considerations
- **No Secrets on Client:** Groq API keys and Supabase Service Role keys are completely sequestered behind Cloudflare Workers. Only the anon-key for Supabase is exposed to the frontend.
- **XSS Prevention:** All dynamic data inserted into the DOM (especially AI responses or user progress text) is strictly sanitized using `textContent` instead of `innerHTML` where applicable.
