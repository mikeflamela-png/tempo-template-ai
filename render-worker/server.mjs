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
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { openBrowser, renderMedia, selectComposition } from "@remotion/renderer";
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
const BUILD_ID =
  process.env.RENDER_GIT_COMMIT ??
  process.env.COMMIT_SHA ??
  process.env.SOURCE_VERSION ??
  process.env.WORKER_BUILD_ID ??
  "local";
const BUILD_TIME =
  process.env.WORKER_BUILD_TIME ??
  new Date(fs.statSync(path.join(BUNDLE_DIR, "index.html")).mtimeMs).toISOString();
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
console.log(`BUILD_ID=${BUILD_ID} BUILD_TIME=${BUILD_TIME}`);

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
const LOG_LEVEL = "info";
const CHROMIUM_OPTIONS = { gl: "swangle", headless: true };
// Remotion 4 always creates a short-lived off-thread media proxy. Giving it an
// explicit non-default port prevents port 3000, and patch-remotion-proxy.mjs
// binds it to 127.0.0.1 so Render sees only process.env.PORT as a public port.
const REMOTION_PROXY_PORT = Number(process.env.REMOTION_PROXY_PORT ?? 45123);

function logRemotionCall(api, details) {
  console.log(`[remotion] ${api} inputs=${JSON.stringify(details)}`);
}

function listenerSnapshot(tag) {
  const result = spawnSync(
    "sh",
    [
      "-c",
      "if command -v ss >/dev/null 2>&1; then ss -ltnp; elif command -v netstat >/dev/null 2>&1; then netstat -ltnp; else echo listener-tool-unavailable; fi",
    ],
    { encoding: "utf8", timeout: 3000 },
  );
  const lines = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .split("\n")
    .filter((line) =>
      line.includes(`:${PORT}`) ||
      line.includes(`:${REMOTION_PROXY_PORT}`) ||
      line.includes(":3000") ||
      line.includes(":3001"),
    );
  console.log(
    `[listeners:${tag}] workerPid=${process.pid} ${lines.length ? lines.join(" | ") : "no target listeners found"}`,
  );
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

/* ---------------------------------------------------------------- express */

const app = express();
app.use(cors());
app.use("/assets", express.static(ASSETS));
// Serve the prebuilt Remotion bundle from THIS listener. If we hand Remotion a
// local directory it starts its own static server (default port 3000), which
// Render detects as a second open port and then routes traffic to — the source
// of the 502s. Passing an http:// serveUrl keeps exactly one listener alive.
app.use("/bundle", express.static(BUNDLE_DIR));
const SERVE_URL = `http://127.0.0.1:${PORT}/bundle/index.html`;

async function verifyBundleRoute() {
  const response = await fetch(SERVE_URL, { signal: AbortSignal.timeout(5000) });
  const body = await response.text();
  if (!response.ok || !body.includes("<!DOCTYPE html")) {
    throw new Error(
      `Bundle route preflight failed: ${SERVE_URL} returned ${response.status} (${body.slice(0, 160)})`,
    );
  }
  console.log(`[bundle] verified ${SERVE_URL} status=${response.status} bytes=${Buffer.byteLength(body)}`);
}


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

// Deliberately does zero filesystem / render work: it must answer instantly
// even while a render is saturating the single CPU.
const BUNDLE_OK = fs.existsSync(path.join(BUNDLE_DIR, "index.html"));
const BROWSER_OK = BROWSER ? fs.existsSync(BROWSER) : null;
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    status: "ready",
    bundleFound: BUNDLE_OK,
    bundlePath: BUNDLE_DIR,
    browserFound: BROWSER_OK,
    browserPath: BROWSER || null,
    concurrency: CONCURRENCY,
    activeJobs,
    peakRssMb: Math.round(peakRss / 1048576),
    buildId: BUILD_ID,
    buildTime: BUILD_TIME,
  });
});


/* ------------------------------------------------------------------ render */

/**
 * Runs one render in a dedicated child process.
 *
 * Rendering is the only part of this service that can die: Chromium is by far
 * the fattest process in the container, so when the kernel OOM killer fires it
 * takes the render down. Keeping it out-of-process means the HTTP listener
 * survives, the job is marked failed with the real signal, and /health,
 * /status and /download keep answering.
 */
function render({ jobId, inputProps, width, height, crf, label }) {
  activeJobs += 1;
  const outputLocation = path.join(OUT, `${jobId}.mp4`);
  const cfgPath = path.join(STATE, `${jobId}.cfg.json`);
  const startedAt = Date.now();
  fs.writeFileSync(
    cfgPath,
    JSON.stringify({
      jobId,
      serveUrl: SERVE_URL,
      outputLocation,
      inputProps,
      width,
      height,
      crf: crf ?? 18,
      concurrency: CONCURRENCY,
      browser: BROWSER || null,
      proxyPort: REMOTION_PROXY_PORT,
      timeoutMs: Number(process.env.REMOTION_FRAME_TIMEOUT_MS ?? 120_000),
    }),
  );

  return new Promise((resolve, reject) => {
    listenerSnapshot(`${label}-before-remotion`);
    mem(`${label}-before-child`);
    const child = spawn(
      process.execPath,
      ["--max-old-space-size=512", path.join(__dirname, "render-job.mjs"), cfgPath],
      { stdio: ["ignore", "inherit", "inherit", "ipc"], env: process.env },
    );
    console.log(`EXPORT_05_BROWSER_LAUNCHED-pending job=${jobId} childPid=${child.pid}`);
    let probe = null;
    let failure = null;
    let settled = false;

    child.on("message", (msg) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "progress") {
        setJob(jobId, {
          state: "rendering",
          progress: Math.min(0.99, Number(msg.progress) || 0),
          renderedFrames: msg.renderedFrames ?? null,
          totalFrames: msg.totalFrames ?? null,
          stage: msg.stitchStage === "muxing" ? "encoding" : "rendering",
        });
      } else if (msg.type === "done") {
        probe = msg.probe;
      } else if (msg.type === "error") {
        failure = msg;
      }
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      activeJobs -= 1;
      console.error(`EXPORT_FAILED_STAGE=child-spawn ERROR=${err?.message} STACK=${err?.stack}`);
      reject(new Error(`Render process could not start: ${err?.message ?? err}`));
    });

    child.on("exit", async (code, signal) => {
      if (settled) return;
      settled = true;
      activeJobs -= 1;
      fs.rmSync(cfgPath, { force: true });
      console.log(`CHILD_EXIT job=${jobId} code=${code} signal=${signal ?? "none"}`);
      listenerSnapshot(`${label}-after-remotion`);
      const port3000After = await checkPort(3000);
      console.log(`[listeners:${label}-after-remotion] port3000Open=${port3000After}`);
      mem(`${label}-after-child`);
      const seconds = Math.round((Date.now() - startedAt) / 1000);

      if (code === 0 && probe && fs.existsSync(outputLocation)) {
        console.log(
          `EXPORT_12_JOB_COMPLETED job=${jobId} bytes=${probe.bytes} ${probe.width}x${probe.height} ${probe.duration}s wall=${seconds}s`,
        );
        resolve(outputLocation);
        return;
      }
      if (failure) {
        reject(new Error(`${failure.stage}: ${failure.message}`));
        return;
      }
      if (signal === "SIGKILL") {
        reject(
          new Error(
            "The render process was killed by the host (SIGKILL) — this is an out-of-memory kill on the render instance.",
          ),
        );
        return;
      }
      reject(new Error(`Render process exited unexpectedly (code=${code} signal=${signal ?? "none"})`));
    });
  });
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
  if (!auth(req, res)) return;
  const file = path.join(OUT, `${path.basename(req.params.id)}.mp4`);
  if (!fs.existsSync(file)) return res.status(404).end();
  // res.download streams the file; it is never read into memory.
  res.download(file, "tempo-export.mp4");
});

// A crashed Chromium/ffmpeg child must never take the HTTP listener down —
// the job is already marked failed by the render() catch block.
process.on("unhandledRejection", (err) => {
  console.error("[worker] unhandledRejection", err?.stack ?? err);
});
process.on("uncaughtException", (err) => {
  console.error("[worker] uncaughtException", err?.stack ?? err);
});
process.on("warning", (warning) => {
  console.error("[worker] warning", warning.stack ?? warning.message);
});
process.on("beforeExit", (code) => {
  console.error(`[worker] beforeExit code=${code} activeJobs=${activeJobs}`);
});
process.on("exit", (code) => {
  console.error(`[worker] exit code=${code} activeJobs=${activeJobs}`);
});
let httpServer;
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(signal, () => {
    console.error(`[worker] received ${signal} pid=${process.pid} activeJobs=${activeJobs}`);
    httpServer?.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}


httpServer = http.createServer(app);
httpServer.on("error", (err) => {
  console.error("[worker] HTTP server error", err?.stack ?? err);
});
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Tempo render worker listening on port ${PORT} (${PUBLIC_URL})`);
  listenerSnapshot("startup");
  console.log("Worker ready");
});
