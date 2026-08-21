# Tempo render worker — real Remotion H.264 rendering.
#
# Everything the renderer needs is baked into the image at BUILD time:
#   - ffmpeg / ffprobe
#   - a Chromium executable (no Chrome Headless Shell download at runtime)
#   - the prebuilt Remotion bundle of src/remotion/index.ts
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg chromium iproute2 ca-certificates fonts-liberation libnss3 libdbus-1-3 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
    libcairo2 libxshmfence1 \
  && rm -rf /var/lib/apt/lists/*

# Use the distro Chromium; Remotion never downloads its own browser.
ENV BROWSER_EXECUTABLE=/usr/bin/chromium
ENV REMOTION_SKIP_BROWSER_DOWNLOAD=1
ENV REMOTION_BUNDLE_DIR=/app/render-worker/bundle
ARG RENDER_GIT_COMMIT=unknown
ARG WORKER_BUILD_TIME=unknown
ENV RENDER_GIT_COMMIT=$RENDER_GIT_COMMIT
ENV WORKER_BUILD_TIME=$WORKER_BUILD_TIME

WORKDIR /app
COPY . .

RUN npm install --no-package-lock --legacy-peer-deps \
 && npm --prefix render-worker install --no-package-lock \
 && node render-worker/patch-remotion-proxy.mjs

# Bundle the Remotion composition at image build time. Webpack at runtime is
# what pushed the container over its memory limit and killed renders.
RUN NODE_OPTIONS=--max-old-space-size=3584 node render-worker/prebundle.mjs

# Fail the BUILD (not a production render) if anything is missing.
RUN set -eux; \
    node -e "require('/app/render-worker/node_modules/@remotion/renderer/package.json')"; \
    grep -F "server.listen({ port, host: '127.0.0.1' });" /app/render-worker/node_modules/@remotion/renderer/dist/serve-static.js; \
    which ffmpeg; ffmpeg -version | head -n1; \
    which ffprobe; ffprobe -version | head -n1; \
    test -x "$BROWSER_EXECUTABLE"; "$BROWSER_EXECUTABLE" --version; \
    test -f "$REMOTION_BUNDLE_DIR/index.html"

ENV PORT=10000
ENV RENDER_CONCURRENCY=1
EXPOSE 10000
CMD ["node", "render-worker/server.mjs"]
