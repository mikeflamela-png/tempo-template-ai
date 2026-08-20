# Tempo render worker

Real MP4/H.264 export for Tempo. Remotion's renderer needs Chromium + ffmpeg, which
the app's edge runtime cannot provide, so exports are handed to this service. It
bundles `src/remotion/index.ts` — the exact composition the browser Player renders —
so preview and export cannot drift apart.

## Run locally

```bash
cd render-worker
npm install
cd ..
node render-worker/server.mjs        # from the repo root
```

Then set the app secret so the editor talks to it:

```
REMOTION_WORKER_URL=http://localhost:8787
REMOTION_WORKER_TOKEN=<optional shared secret>
```

Add these in the project's secrets. Without `REMOTION_WORKER_URL` the export dialog
tells the user rendering is not connected and offers the render job for download.

## Deploy

Any Node host with 2+ vCPU works (Fly.io, Railway, Render, a VPS). Set:

- `PORT` — listen port (default 8787)
- `PUBLIC_URL` — externally reachable base URL, used for asset + download links
- `REMOTION_WORKER_TOKEN` — shared secret, required in `Authorization: Bearer`
- `RENDER_CONCURRENCY` — Chromium tabs per render (default 2)

```dockerfile
FROM node:20-bookworm
RUN apt-get update && apt-get install -y ffmpeg libnss3 libdbus-1-3 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm install && npm --prefix render-worker install
CMD ["node", "render-worker/server.mjs"]
```

## Protocol

| Endpoint | Purpose |
| --- | --- |
| `POST /render` | multipart: `job` (JSON) plus `media:<slotId>` and `audio` files |
| `GET /status/:id` | `{ state: queued\|rendering\|done\|error, progress, url, error }` |
| `GET /download/:id` | the finished MP4 |
| `GET /health` | liveness |

The app uploads the actual source clips with the job, so the worker never needs
access to the browser's blob URLs or any shared storage.
