/**
 * TEMPO RENDER WORKER
 *
 * Real Remotion rendering (H.264 MP4) for Tempo. The app's edge runtime cannot
 * run Chromium + ffmpeg, so exports are handed to this small Node service.
 *
 *   node render-worker/server.mjs        # from the repo root
 *
 * Production invariants (see Dockerfile):
 *   - the Remotion bundle is PREBUILT into the image; runtime bundling is fatal
 *   - Chromium is BAKED into the image; no browser download at runtime
 *   - one HTTP listener on process.env.PORT (3000 only as a local fallback)
 *   - one job at a time, concurrency 1, temp files deleted after delivery
 *
 * Endpoints
 *   POST /render        multipart: `job` (JSON) + any number of asset files
 *   GET  /status/:id    { state, progress, url, error }
 *   GET  /download/:id  the finished MP4
 *   GET  /health        cheap liveness + readiness (never renders)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { renderMedia, selectComposition } from "@remotion/renderer";
import express from "express";
import multer from "multer";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(os.tmpdir(), "tempo-render");
const ASSETS = path.join(WORK, "assets");
const OUT = path.join(WORK, "out");
const STATE = path.join(WORK, "jobs");
for (const dir of [ASSETS, OUT, STATE]) fs.mkdirSync(dir, { recursive: true });

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.REMOTION_WORKER_TOKEN ?? "";
const CONCURRENCY = Number(process.env.RENDER_CONCURRENCY ?? 1) || 1;
const BUNDLE_DIR = process.env.REMOTION_BUNDLE_DIR ?? path.join(__dirname, "bundle");
const BROWSER = process.env.BROWSER_EXECUTABLE ?? "";
// Render.com (and most PaaS) inject the public URL for us — no manual config.
const PUBLIC_URL =
  process.env.PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${PORT}`;

/* ------------------------------------------------------------------ memory */

const mb = (n) => `${Math.round(n / 1048576)}MB`;
let peakRss = 0;
function mem(tag) {
  const m = process.memoryUsage();
  if (m.rss > peakRss) peakRss = m.rss;
  console.log(
    `MEM ${tag} RSS=${mb(m.rss)} heapUsed=${mb(m.heapUsed)} heapTotal=${mb(
      m.heapTotal,
    )} external=${mb(m.external)} peakRSS=${mb(peakRss)}`,
  );
}

/* ------------------------------------------------------ startup preflight */

console.log("Tempo render worker starting");
console.log(`PORT=${PORT}`);

if (!fs.existsSync(path.join(BUNDLE_DIR, "index.html"))) {
  console.error(
    `FATAL: prebuilt Remotion bundle missing at ${BUNDLE_DIR}. ` +
      `The image must run render-worker/prebundle.mjs at build time; ` +
      `runtime bundling is disabled (it OOMs the instance).`,
  );
  process.exit(1);
}
console.log(`Prebuilt Remotion bundle found: ${BUNDLE_DIR}`);

if (BROWSER) {
  if (!fs.existsSync(BROWSER)) {
    console.error(`FATAL: BROWSER_EXECUTABLE set to ${BROWSER} but that file does not exist.`);
    process.exit(1);
  }
  console.log(`Browser executable found: ${BROWSER}`);
} else {
  console.log("Browser executable: not pinned (BROWSER_EXECUTABLE unset) — Remotion default");
}

try {
  const v = execFileSync("ffmpeg", ["-version"]).toString().split("\n")[0];
  console.log(`ffmpeg found: ${v}`);
} catch {
  console.error("FATAL: ffmpeg not found on PATH.");
  process.exit(1);
}
console.log(`RENDER_CONCURRENCY=${CONCURRENCY}`);
mem("startup");

const browserOpt = BROWSER ? { browserExecutable: BROWSER } : {};

/* ---------------------------------------------------------------- express */

const app = express();
app.use(cors());
app.use("/assets", express.static(ASSETS));

// Multer streams every part straight to disk — nothing is buffered in memory.
const upload = multer({
  storage: multer.diskStorage({
    destination: ASSETS,
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${path.extname(file.originalname || "").slice(0, 10)}`),
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
});

/** jobId -> { state, progress, url, error } (mirrored to disk so a restart
 *  does not lose a finished job's id). */
const jobs = new Map();
let activeJobs = 0;

function setJob(id, value) {
  jobs.set(id, value);
  if (value.state === "done" || value.state === "error") {
    try {
      fs.writeFileSync(path.join(STATE, `${id}.json`), JSON.stringify(value));
    } catch {
      /* status is best-effort */
    }
  }
}
function getJob(id) {
  const inMemory = jobs.get(id);
  if (inMemory) return inMemory;
  try {
    return JSON.parse(fs.readFileSync(path.join(STATE, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

function cleanupFiles(files) {
  for (const f of files ?? []) {
    try {
      fs.rmSync(f, { force: true });
    } catch {
      /* ignore */
    }
  }
}

// Drop render output + state older than 6h so /tmp cannot fill up.
setInterval(
  () => {
    const cutoff = Date.now() - 6 * 3600_000;
    for (const dir of [OUT, STATE, ASSETS]) {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        try {
          if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { force: true });
        } catch {
          /* ignore */
        }
      }
    }
  },
  30 * 60_000,
).unref();

function auth(req, res) {
  if (!TOKEN) return true;
  if (req.headers.authorization === `Bearer ${TOKEN}`) return true;
  res.status(401).json({ error: "unauthorized" });
  return false;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    status: "ready",
    bundleFound: fs.existsSync(path.join(BUNDLE_DIR, "index.html")),
    bundlePath: BUNDLE_DIR,
    browserFound: BROWSER ? fs.existsSync(BROWSER) : null,
    browserPath: BROWSER || null,
    concurrency: CONCURRENCY,
    activeJobs,
    peakRssMb: Math.round(peakRss / 1048576),
  });
});

/* ------------------------------------------------------------------ render */

async function render({ jobId, inputProps, width, height, crf, label }) {
  activeJobs += 1;
  const outputLocation = path.join(OUT, `${jobId}.mp4`);
  try {
    mem(`${label}-before-browser`);
    const base = await selectComposition({
      serveUrl: BUNDLE_DIR,
      id: "tempo",
      inputProps,
      ...browserOpt,
    });
    mem(`${label}-after-browser`);
    const composition = { ...base, width: width ?? base.width, height: height ?? base.height };
    setJob(jobId, { state: "rendering", progress: 0.02 });
    mem(`${label}-render-start`);
    const ticker = setInterval(() => mem(`${label}-render-tick`), 10_000);
    try {
      await renderMedia({
        composition,
        serveUrl: BUNDLE_DIR,
        codec: "h264",
        crf: crf ?? 18,
        outputLocation,
        inputProps,
        concurrency: CONCURRENCY,
        chromiumOptions: { gl: "swangle" },
        ...browserOpt,
        onProgress: ({ progress }) => setJob(jobId, { state: "rendering", progress }),
      });
    } finally {
      clearInterval(ticker);
    }
    mem(`${label}-render-complete`);
    return outputLocation;
  } finally {
    activeJobs -= 1;
    if (global.gc) global.gc();
  }
}

/**
 * Real proof-of-life: renders a 2s vertical 1080x1920 H.264 clip through the
 * exact same Remotion pipeline as a user export. Self-contained — no user
 * assets, no project state. Returns the finished MP4.
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
  const jobId = `test-${randomUUID()}`;
  try {
    mem("test-render-accepted");
    const file = await render({
      jobId,
      inputProps,
      width: 1080,
      height: 1920,
      crf: 20,
      label: "test",
    });
    res.download(file, "tempo-test.mp4", () => {
      cleanupFiles([file]);
      mem("test-after-cleanup");
    });
  } catch (err) {
    mem("test-error");
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
    cleanupFiles((req.files ?? []).map((f) => f.path));
    return res.status(400).json({ error: "invalid job payload" });
  }

  // map uploaded files onto the spec's media / audio references
  const byField = Object.fromEntries((req.files ?? []).map((f) => [f.fieldname, f]));
  const uploaded = (req.files ?? []).map((f) => f.path);
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
  setJob(jobId, { state: "queued", progress: 0 });
  res.json({ jobId });
  mem("job-accepted");

  (async () => {
    try {
      await render({
        jobId,
        inputProps: {
          spec: job.spec,
          media,
          textOverrides: job.textOverrides ?? {},
          audio,
          assetUrls,
          fontFaces,
        },
        width: job.output?.width,
        height: job.output?.height,
        crf: job.output?.crf ?? 18,
        label: "job",
      });
      setJob(jobId, { state: "done", progress: 1, url: `${PUBLIC_URL}/download/${jobId}` });
    } catch (err) {
      mem("job-error");
      console.error("[render]", err);
      setJob(jobId, { state: "error", progress: 0, error: String(err?.message ?? err) });
    } finally {
      // source clips are only needed while the render runs
      cleanupFiles(uploaded);
      mem("job-after-cleanup");
    }
  })();
});

app.get("/status/:id", (req, res) => {
  if (!auth(req, res)) return;
  res.json(getJob(req.params.id) ?? { state: "error", error: "unknown job" });
});

app.get("/download/:id", (req, res) => {
  const file = path.join(OUT, `${path.basename(req.params.id)}.mp4`);
  if (!fs.existsSync(file)) return res.status(404).end();
  // res.download streams the file; it is never read into memory.
  res.download(file, "tempo-export.mp4");
});

http.createServer(app).listen(PORT, "0.0.0.0", () => {
  console.log(`Tempo render worker listening on port ${PORT} (${PUBLIC_URL})`);
  console.log("Worker ready");
});
