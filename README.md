# OpusHeart

**A free, source-available community platform for churches and organizations who serve.**

Website builder, member management, events, groups, communication, resource hub, prayer wall, sermon archive, giving — and a federation mesh that connects communities across the world.

Built so that small, underserved churches and community organizations can have access to the same tools as megachurches — and to each other.

## Why OpusHeart?

A simple prayer should be able to reach the whole world — not in faith alone, but through concrete federation across every community that opens its heart.

OpusHeart is free and source-available for nonprofit and community use — and always will be.

## Quick Start

```bash
# Clone and install
git clone https://github.com/137andCo/opusheart.git
cd opusheart
pnpm install

# Start dependencies
docker compose up -d mongo redis

# Configure
cp .env.example .env
# Edit .env with your settings

# Run
pnpm dev:server    # API on :3020
pnpm dev:dashboard # Admin SPA on :3021
pnpm dev:web       # Public site on :3022
```

## Architecture

Monorepo with pnpm workspaces:

- `packages/shared` -- Types, schemas, constants
- `packages/server` -- Express 5 API (MongoDB, Redis)
- `packages/dashboard` -- Nuxt 4 SPA (admin)
- `packages/web` -- Nuxt 4 SSR (public site)
- `packages/ai` -- AI provider adapters (optional, bring your own key)
- `packages/builder` -- page-builder block model (block types, schemas, registry)
- `packages/connect` -- federation client for the Connect mesh protocol
- `verticals/church` -- church vertical preset: role labels, terminology, and feature defaults (served at `GET /api/vertical`)

## Features

- **Website Builder** — Templates, themes, and page editor
- **Member Management** — Households, care notes, attendance tracking
- **Events** — RSVP, volunteer slots, bookable resources
- **Groups** — Membership, materials, real-time chat
- **Communication** — Email and web-push notifications, scheduled sends (SMS planned, bring-your-own-provider)
- **Prayer Wall** — Community prayer requests with moderation
- **Sermons** — Archive with podcast RSS feed
- **Resource Hub** — Public community directory with search (Elasticsearch-backed when enabled, MongoDB otherwise)
- **Giving** — Fund management and donor statements
- **Connect Federation** — Inter-community collaboration mesh (experimental, off by default)
- **AI Assistance** — Optional content tools (bring your own API key)
- **PWA** — Installable app; caches public content (resources, events, sermons) for poor connections
- **GDPR Compliance** — Data export and account deletion

## AI Features (Optional)

OpusHeart includes optional AI-powered features (content drafting, sermon summarization, prayer categorization). These are completely optional and disabled by default.

To enable, set `ENABLE_AI=true` in your `.env` and provide your own API key:

```env
ENABLE_AI=true
AI_PROVIDER=openai        # or: anthropic
AI_API_KEY=your-key-here
AI_MODEL=gpt-4o-mini      # or any compatible model
AI_BASE_URL=https://api.openai.com/v1  # optional, for custom endpoints
```

Any OpenAI-compatible endpoint works (Ollama, LiteLLM, etc.) — set `AI_BASE_URL` to your local or hosted endpoint.

## Hosted Option

Don't want to self-host? [137 & Co.](https://137andco.com) offers managed OpusHeart deployments with an integrated AI gateway, so your community can use AI features without managing API keys. Contact us at hello@137andco.com for pricing.

## Self-Hosting

See [docs/self-host-guide.md](docs/self-host-guide.md) for Docker and manual deployment instructions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

OpusHeart is **source-available** under the [PolyForm Noncommercial License 1.0.0](LICENSE).

Use it freely for any **noncommercial** purpose — explicitly including churches, charities, nonprofits, schools, public-health and public-safety organizations, and government bodies, regardless of how they're funded. **Commercial / for-profit use is not permitted** under this license. For commercial use or a managed deployment, contact [137 & Co.](https://137andco.com) at hello@137andco.com.

Contributions are accepted under the same license — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

Made with purpose by [137 & Co.](https://137andco.com)
