# Avennex Backend API

FastAPI backend for avennex.com. Handles blogs, jobs, products, launchpad entries, admin auth, and email.

## Setup

1. Copy `.env.example` to `.env` and fill in values
2. Run `schema.sql` in Supabase SQL Editor
3. Install dependencies: `pip install -r requirements.txt`
4. Seed admin user: `python seed.py`
5. Run server: `uvicorn app.main:app --reload`

## Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - Admin login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Revoke refresh token
- `GET /api/docs` - API documentation (Swagger)

## Deployment

Deployed on Render.com. See `render.yaml` for config.
