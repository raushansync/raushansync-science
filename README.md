# RaushanSYNC Science

Welcome to the **RaushanSYNC Science** platform — a high-performance, static-first web application built for educational purposes. It delivers an offline-capable, highly dynamic student experience using vanilla technologies and serverless edges.

## ✨ Features

- **Blazing Fast Performance**: Built using vanilla HTML5, CSS3, and JavaScript with zero heavy frameworks, ensuring instantaneous load times.
- **Offline Capabilities**: Full PWA integration with Service Workers for offline studying.
- **AI Tutor Integration**: Powered by Groq API via Cloudflare Workers for instant AI-assisted learning.
- **Secure Authentication**: Complete student auth flow using Supabase (PostgreSQL + RLS).
- **Progress Tracking**: Sophisticated local and remote syncing of learning progress.
- **Responsive Design**: Beautiful CSS architecture tailored for all devices.

## 🏗️ Tech Stack

- **Frontend**: Vanilla HTML / CSS / JS (No Build Step needed)
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security)
- **Edge Functions**: Cloudflare Workers (for wrapping AI/LLM API calls securely)
- **Hosting & CDN**: GitHub Pages + Cloudflare Edge

## 🌐 Production

- **Website**: https://science.raushansync.com
- **AI Worker**: https://quiz-ai-tutor.raushanguptaicloud.workers.dev/

## 📖 Architecture

For the complete technical design, data flow contracts, security boundaries, and deployment runbook, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 🚀 Quick Start / Local Development

Since this project avoids heavy bundlers, getting started is extremely straightforward:

### 1. **Clone the repository:**
```bash
git clone https://github.com/your-username/raushansync-science.git
cd raushansync-science
```

### 2. **Run a local web server:**
You can use python, live-server, or any basic HTTP server to serve the root directory.
```bash
npx live-server .
# or
python -m http.server 8000
```

### 3. **Cloudflare Worker (AI Chat):**
If you need to test the Groq AI integration locally, use Wrangler:
```bash
npm install
npx wrangler dev
```

Run smoke checks before deploy:
```bash
npm test
```

## 🔒 Environment Configuration

Client-side Supabase uses the public project URL and anon key. Never expose your Supabase Service Role key in the frontend.

For the AI feature, configure your **Groq API key** as a Cloudflare Worker secret:
```bash
npx wrangler secret put GROQ_API_KEY
```

The worker validates Supabase access tokens before processing AI requests. Keep these worker variables in `wrangler.jsonc` under `vars`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

`SUPABASE_ANON_KEY` is a public key and does not need to be stored as a secret.

## 🗄️ Database Schema

The core Supabase schema (for Auth, Profiles, and Progress parsing) relies on standard Supabase Authentication and RLS (Row Level Security). Ensure your policies permit `SELECT`, `INSERT`, and `UPDATE` only where `auth.uid() = user_id`.

## 📄 License

See the [LICENSE](./LICENSE) file for more details.
