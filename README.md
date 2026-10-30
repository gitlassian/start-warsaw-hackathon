# RollCall

One shared photo roll for every event. Next.js (mobile-first) + FastAPI + Postgres + MinIO (S3).

```
web/   Next.js 16 app. Proxies /api → FastAPI and /s3 → MinIO, so the browser only talks to one origin.
api/   FastAPI: Google sign-in, events, join codes, presigned S3 uploads.
```

## Run locally

1. Google sign-in: in Google Cloud Console → Credentials, create an **OAuth client ID (Web application)** and add
   `http://localhost:3000` to *Authorized JavaScript origins*.
2. Env files:
   ```bash
   cp api/.env.example api/.env        # set GOOGLE_CLIENT_ID and JWT_SECRET
   cp web/.env.example web/.env.local  # set NEXT_PUBLIC_GOOGLE_CLIENT_ID (same client ID)
   ```
3. Start everything:
   ```bash
   docker compose up -d                                              # Postgres :5432, MinIO :9000 (console :9001)
   cd api && uv run uvicorn main:app --reload --env-file .env --port 8000
   cd web && npm install && npm run dev                              # http://localhost:3000
   ```
   Tables and the bucket are created on API start.

Tests: `cd api && uv run pytest`.

## Testing on a phone

Google only allows sign-in from `localhost` or HTTPS origins, so expose the dev server over HTTPS
(e.g. `cloudflared tunnel --url http://localhost:3000`) and add that URL to the OAuth client's origins.

## How it works

- **Auth:** Google Identity Services gives the browser an ID token → `POST /api/auth/google` verifies it and sets an
  httpOnly `session` cookie (JWT, 30 days).
- **Uploads:** browser asks `POST /api/uploads` for presigned PUT URLs, uploads the original plus a 600px thumbnail
  straight to S3, then registers the photo. Originals are kept; "Save" downloads the original.
- **Joining:** each event has a 6-character code; the QR encodes `https://<host>/join/<CODE>`.
- **Permissions:** only members see an event. Authors delete their own photos; the owner can delete any.

## Production notes

- Set `COOKIE_SECURE=true`, a long random `JWT_SECRET`, and serve over HTTPS.
- Uploads through the `/s3` rewrite are buffered by Next.js (up to 55 MB each). At scale, point `S3_PUBLIC_URL`
  at the bucket's public endpoint and configure bucket CORS so uploads bypass Next.
- The `minio/minio` Docker images are no longer published; compose uses `cgr.dev/chainguard/minio`.
