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
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;

const app = express();
app.use(cors());
app.use("/assets", express.static(ASSETS));

const upload = multer({ dest: ASSETS, limits: { fileSize: 1024 * 1024 * 1024 } });

/** jobId -> { state, progress, url, error } */
const jobs = new Map();

let bundlePromise = null;
function getBundle() {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint: path.join(ROOT, "src/remotion/index.ts"),
      webpackOverride: (c) => c,
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
      };
      const base = await selectComposition({ serveUrl, id: "tempo", inputProps });
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
