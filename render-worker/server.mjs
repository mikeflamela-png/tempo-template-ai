/**
 * TEMPO RENDER WORKER
 *
 * Real Remotion rendering (H.264 MP4) for Tempo. The app's edge runtime cannot
 * run Chromium + ffmpeg, so exports are handed to this small Node service.
 *
 *   node render-worker/server.mjs        # from the repo root
 *
 * It bundles `src/remotion/index.ts` — the SAME composition the browser Player
 * uses — so what you preview is what you export.
 *
 * Endpoints
 *   POST /render        multipart: `job` (JSON) + any number of asset files
 *   GET  /status/:id    { state, progress, url, error }
 *   GET  /download/:id  the finished MP4
 *   GET  /health
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import express from "express";
import multer from "multer";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORK = path.join(os.tmpdir(), "tempo-render");
const ASSETS = path.join(WORK, "assets");
const OUT = path.join(WORK, "out");
fs.mkdirSync(ASSETS, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.REMOTION_WORKER_TOKEN ?? "";
// Render.com (and most PaaS) inject the public URL for us — no manual config.
const PUBLIC_URL =
  process.env.PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${PORT}`;

const app = express();
app.use(cors());
app.use("/assets", express.static(ASSETS));

// Keep the original file extension: Chromium refuses to decode media served
// without a proper content-type, and express.static infers it from the name.
const upload = multer({
  storage: multer.diskStorage({
    destination: ASSETS,
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${path.extname(file.originalname || "").slice(0, 10)}`),
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
});


/** jobId -> { state, progress, url, error } */
const jobs = new Map();

let bundlePromise = null;
function getBundle() {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: path.join(ROOT, "src/remotion/index.ts"),
      // the app resolves "@/..." through tsconfig paths; webpack needs it spelled out
      webpackOverride: (c) => ({
        ...c,
        resolve: {
          ...c.resolve,
          alias: { ...(c.resolve?.alias ?? {}), "@": path.join(ROOT, "src") },
        },
      }),
    });
  }
  return bundlePromise;
}

function auth(req, res) {
  if (!TOKEN) return true;
  if (req.headers.authorization === `Bearer ${TOKEN}`) return true;
  res.status(401).json({ error: "unauthorized" });
  return false;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * Real proof-of-life: renders a 2s vertical 1080x1920 H.264 clip through the
 * exact same Remotion pipeline as a user export. Returns the finished MP4.
 */
app.get("/test-render", async (req, res) => {
  if (!auth(req, res)) return;
  const spec = {
    id: "render-test",
    name: "Render test",
    duration: 2,
    fps: 30,
    width: 1080,
    height: 1920,
    tags: [],
    palette: { bg: "#0b0b0d", ink: "#f5f2ec", accent: "#e8ff54" },
    mediaSlots: [],
    textSlots: [
      {
        id: "t1",
        label: "TEST",
        value: "TEMPO RENDER TEST",
        start: 0,
        duration: 2,
        style: "centered_statement",
        position: "center",
        align: "center",
      },
    ],
    overlays: [{ type: "grain", start: 0, duration: 2 }],
    beatMarkers: [],
    creativeProfile: {
      family: "test",
      energy: "calm",
      pacing: "steady",
      typography: "minimal",
      transitionStyle: "cut",
      structure: "single",
    },
  };
  const inputProps = { spec, media: {}, textOverrides: {}, audio: null, assetUrls: {}, fontFaces: [] };
  try {
    const serveUrl = await getBundle();
    const composition = await selectComposition({
      serveUrl,
      id: "tempo",
      inputProps,
      ...(process.env.BROWSER_EXECUTABLE ? { browserExecutable: process.env.BROWSER_EXECUTABLE } : {}),
    });
    const outputLocation = path.join(OUT, `test-${randomUUID()}.mp4`);
    await renderMedia({
      composition: { ...composition, width: 1080, height: 1920 },
      serveUrl,
      codec: "h264",
      crf: 20,
      outputLocation,
      inputProps,
      concurrency: Number(process.env.RENDER_CONCURRENCY ?? 2),
      chromiumOptions: { gl: "swangle" },
      ...(process.env.BROWSER_EXECUTABLE ? { browserExecutable: process.env.BROWSER_EXECUTABLE } : {}),
    });
    res.download(outputLocation, "tempo-test.mp4");
  } catch (err) {
    console.error("[test-render]", err);
    res.status(500).json({ ok: false, error: String(err?.stack ?? err?.message ?? err) });
  }
});


app.post("/render", upload.any(), async (req, res) => {
  if (!auth(req, res)) return;
  let job;
  try {
    job = JSON.parse(req.body.job);
  } catch {
    return res.status(400).json({ error: "invalid job payload" });
  }

  // map uploaded files onto the spec's media / audio references
  const byField = Object.fromEntries((req.files ?? []).map((f) => [f.fieldname, f]));
  const media = {};
  for (const [slotId, entry] of Object.entries(job.media ?? {})) {
    const file = byField[`media:${slotId}`];
    if (!file) continue;
    media[slotId] = { ...entry, url: `${PUBLIC_URL}/assets/${path.basename(file.path)}` };
  }
  let audio = null;
  if (job.audio && byField["audio"]) {
    audio = { ...job.audio, url: `${PUBLIC_URL}/assets/${path.basename(byField["audio"].path)}` };
  }

  // Imported motion assets, brand logos/product shots and uploaded brand fonts
  // arrive as `asset:<id>` / `font:<id>` parts — the render machine has no
  // access to the browser stores they normally come from.
  const assetUrls = {};
  const fontFaces = [];
  for (const [field, file] of Object.entries(byField)) {
    const url = `${PUBLIC_URL}/assets/${path.basename(file.path)}`;
    if (field.startsWith("asset:")) {
      const id = field.slice("asset:".length);
      const meta = job.assetMeta?.[id] ?? {};
      assetUrls[id] = {
        url,
        kind: meta.kind ?? "image",
        ...(meta.loop ? { loop: true } : {}),
        ...(meta.speed ? { speed: meta.speed } : {}),
      };
    } else if (field.startsWith("font:")) {
      const key = field.slice("font:".length);
      const meta = (job.fonts ?? []).find((f) => f.key === key);
      if (meta) fontFaces.push({ key, family: meta.family, url });
    }
  }

  const jobId = randomUUID();
  jobs.set(jobId, { state: "queued", progress: 0 });
  res.json({ jobId });

  (async () => {
    try {
      const serveUrl = await getBundle();
      const inputProps = {
        spec: job.spec,
        media,
        textOverrides: job.textOverrides ?? {},
        audio,
        assetUrls,
        fontFaces,
      };
      const base = await selectComposition({
        serveUrl,
        id: "tempo",
        inputProps,
        ...(process.env.BROWSER_EXECUTABLE
          ? { browserExecutable: process.env.BROWSER_EXECUTABLE }
          : {}),
      });
      // honour the export format chosen in the app (vertical / square / landscape)
      const composition = {
        ...base,
        width: job.output?.width ?? base.width,
        height: job.output?.height ?? base.height,
      };
      const outputLocation = path.join(OUT, `${jobId}.mp4`);
      jobs.set(jobId, { state: "rendering", progress: 0.02 });
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        crf: job.output?.crf ?? 18,
        outputLocation,
        inputProps,
        concurrency: Number(process.env.RENDER_CONCURRENCY ?? 2),
        chromiumOptions: { gl: "swangle" },
        // optional escape hatch for hosts that already ship a Chromium
        ...(process.env.BROWSER_EXECUTABLE
          ? { browserExecutable: process.env.BROWSER_EXECUTABLE }
          : {}),
        onProgress: ({ progress }) => jobs.set(jobId, { state: "rendering", progress }),
      });
      jobs.set(jobId, {
        state: "done",
        progress: 1,
        url: `${PUBLIC_URL}/download/${jobId}`,
      });
    } catch (err) {
      jobs.set(jobId, { state: "error", progress: 0, error: String(err?.message ?? err) });
    }
  })();
});

app.get("/status/:id", (req, res) => {
  if (!auth(req, res)) return;
  res.json(jobs.get(req.params.id) ?? { state: "error", error: "unknown job" });
});

app.get("/download/:id", (req, res) => {
  const file = path.join(OUT, `${req.params.id}.mp4`);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.download(file, "tempo-export.mp4");
});

http.createServer(app).listen(PORT, () => {
  console.log(`Tempo render worker listening on ${PUBLIC_URL}`);
});
