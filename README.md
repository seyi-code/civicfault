# CivicFault

**Community Infrastructure & Public Utility Fault Tracker**

Geo-tagged, community-driven incident reporting with computer vision classification, spatial clustering, community upvotes, authority JWT auth, and a public transparency dashboard.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, Leaflet, PWA-ready |
| Backend | FastAPI, SQLAlchemy 2, Alembic, JWT, SlowAPI rate limits |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| ML | YOLOv8 (mock for local; fine-tune path documented) |
| Storage | Local disk or S3 / Cloudflare R2 / MinIO |
| Deploy | Frontend → **Vercel** · Backend → Railway / Render / Fly |

## Features (v1.1)

- Photo + GPS anonymous reports
- CV category + confidence (YOLOv8 or deterministic mock)
- Spatial clustering (50 m, same category, open status)
- Public map + dashboard with cluster sizing
- JWT authority authentication
- Rate limiting on report submission and upvotes
- Community upvotes / confirmation
- Storage abstraction: local or S3-compatible
- English + Luganda message catalogs
- PWA manifest
- Alembic migrations
- Docker Compose for full local stack

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend http://localhost:3000
- API docs http://localhost:8000/docs

## Deploy on Vercel (frontend)

1. Import this GitHub repo in Vercel
2. Root Directory: `frontend`
3. Env: `NEXT_PUBLIC_API_URL=https://<your-backend-host>`
4. Deploy

Backend needs PostGIS elsewhere — see docs/DEPLOYMENT.md

## License

MIT
