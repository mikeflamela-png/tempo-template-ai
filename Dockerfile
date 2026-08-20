# Tempo render worker — real Remotion H.264 rendering (Chromium + ffmpeg).
# Built from the repo root because the worker bundles src/remotion/index.ts,
# the exact composition the browser Player renders.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates fonts-liberation libnss3 libdbus-1-3 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
    libcairo2 libxshmfence1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install --no-package-lock --legacy-peer-deps \
 && npm --prefix render-worker install --no-package-lock \
 && npx remotion browser ensure || true

ENV PORT=8787
EXPOSE 8787
CMD ["node", "render-worker/server.mjs"]
