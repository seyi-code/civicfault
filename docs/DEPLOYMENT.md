# Deployment Guide

## Architecture for production

| Component | Recommended host | Why |
|-----------|------------------|-----|
| Frontend (Next.js) | **Vercel** | Perfect fit, edge, preview deploys |
| Backend (FastAPI) | Railway / Render / Fly.io | Needs long-running process + PostGIS |
| Database | Railway / managed PostGIS | Spatial queries require PostGIS |
| Images | Cloudflare R2 / AWS S3 | Durable, CDN-friendly |

Vercel alone cannot host PostGIS or a persistent FastAPI + YOLO process. Split the stack.

## Frontend → Vercel

1. Import GitHub repo `seyi-code/civicfault`
2. Root Directory: `frontend`
3. Env: `NEXT_PUBLIC_API_URL=https://your-api.example.com`
4. Deploy

## Backend → Railway (example)

1. Deploy from GitHub, root `backend`
2. Add PostgreSQL and run `CREATE EXTENSION postgis;`
3. Set `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS` (include Vercel domain)
4. Start: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`

See full guide in repo docs.
