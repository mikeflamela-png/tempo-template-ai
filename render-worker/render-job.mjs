/**
 * TEMPO RENDER CHILD PROCESS
 *
 * One render, one process. The HTTP worker (server.mjs) spawns this file so a
 * Chromium/ffmpeg crash — or the kernel OOM killer picking the fattest process
 * in the container — can never take the HTTP listener down with it.
 *
 * Contract:
 *   argv[2]  path to a JSON file: { jobId, serveUrl, outputLocation, inputProps,
 *                                   width, height, crf, concurrency, browser,
 *                                   proxyPort, timeoutMs }
 *   stdout   EXPORT_* staged logs (streamed straight to the platform log)
 *   IPC      { type: "progress", progress, renderedFrames, totalFrames }
 *            { type: "stage", stage }
 *            { type: "done", file, probe }
 *            { type: "error", message, stack, stage }
 *   exit 0   success · exit 1 handled failure · signal = killed (see parent)
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { openBrowser, renderMedia, selectComposition } from "@remotion/renderer";

const cfg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const send = (msg) => {
  try {
    process.send?.(msg);
  } catch {
    /* parent gone */
  }
};

let stage = "EXPORT_04_BUNDLE_VERIFIED";
const setStage = (s) => {
  stage = s;
  console.log(`${s} job=${cfg.jobId}`);
  send({ type: "stage", stage: s });
};

const mb = (n) => `${Math.round(n / 1048576)}MB`;
function cgroup() {
  const read = (p) => {
    try {
      return fs.readFileSync(p, "utf8").trim();
    } catch {
      return null;
    }
  };
  const cur = read("/sys/fs/cgroup/memory.current") ?? read("/sys/fs/cgroup/memory/memory.usage_in_bytes");
  const max = read("/sys/fs/cgroup/memory.max") ?? read("/sys/fs/cgroup/memory/memory.limit_in_bytes");
  const peak = read("/sys/fs/cgroup/memory.peak");
  return { cur: cur ? Number(cur) : null, max: max ? Number(max) : null, peak: peak ? Number(peak) : null };
}
function mem(tag) {
  const m = process.memoryUsage();
  const c = cgroup();
  console.log(
    `MEM ${tag} childRSS=${mb(m.rss)} containerUsed=${c.cur ? mb(c.cur) : "n/a"} containerPeak=${
      c.peak ? mb(c.peak) : "n/a"
    } containerLimit=${c.max && c.max < 1e15 ? mb(c.max) : "unlimited"}`,
  );
}

const browserOpt = cfg.browser ? { browserExecutable: cfg.browser } : {};
const CHROMIUM_OPTIONS = { gl: "swangle", headless: true };

async function main() {
  const started = Date.now();
  console.log(`EXPORT_04_BUNDLE_VERIFIED job=${cfg.jobId} serveUrl=${cfg.serveUrl}`);
  const bundleRes = await fetch(cfg.serveUrl, { signal: AbortSignal.timeout(15000) });
  const bundleBody = await bundleRes.text();
  if (!bundleRes.ok || !bundleBody.toLowerCase().includes("<!doctype html")) {
    throw new Error(`BUNDLE_FAILED status=${bundleRes.status} bytes=${bundleBody.length}`);
  }
  console.log(`BUNDLE_OK status=${bundleRes.status} bytes=${Buffer.byteLength(bundleBody)} BUNDLE_ASSETS_OK=true`);
  mem("child-start");

  setStage("EXPORT_05_BROWSER_LAUNCHED");
  console.log("BROWSER_LAUNCH_START");
  const browser = await openBrowser("chrome", {
    ...browserOpt,
    chromeMode: "chrome-for-testing",
    chromiumOptions: CHROMIUM_OPTIONS,
    logLevel: "info",
  });
  console.log(`BROWSER_LAUNCHED id=${browser.id}`);

  try {
    const base = await selectComposition({
      serveUrl: cfg.serveUrl,
      id: "tempo",
      inputProps: cfg.inputProps,
      puppeteerInstance: browser,
      chromeMode: "chrome-for-testing",
      chromiumOptions: CHROMIUM_OPTIONS,
      port: cfg.proxyPort,
      ...browserOpt,
      onBrowserLog: (l) => {
        if (l.type === "error") console.error(`BROWSER_ERROR ${l.text}`);
      },
    });
    const composition = {
      ...base,
      width: cfg.width ?? base.width,
      height: cfg.height ?? base.height,
    };
    setStage("EXPORT_06_COMPOSITION_SELECTED");
    console.log(
      `COMPOSITION ${composition.width}x${composition.height} frames=${composition.durationInFrames} fps=${composition.fps}`,
    );
    mem("after-composition");

    setStage("EXPORT_07_RENDER_STARTED");
    let total = composition.durationInFrames;
    let lastLogged = -1;
    const ticker = setInterval(() => mem("render-tick"), 15_000);
    try {
      await renderMedia({
        composition,
        serveUrl: cfg.serveUrl,
        codec: "h264",
        crf: cfg.crf ?? 18,
        outputLocation: cfg.outputLocation,
        inputProps: cfg.inputProps,
        concurrency: cfg.concurrency ?? 1,
        puppeteerInstance: browser,
        chromeMode: "chrome-for-testing",
        chromiumOptions: CHROMIUM_OPTIONS,
        port: cfg.proxyPort,
        timeoutInMilliseconds: cfg.timeoutMs ?? 120_000,
        ...browserOpt,
        onBrowserLog: (l) => {
          if (l.type === "error") console.error(`BROWSER_ERROR ${l.text}`);
        },
        onStart: ({ frameCount }) => {
          total = frameCount;
          console.log(`EXPORT_07_RENDER_STARTED frames=${frameCount}`);
        },
        onProgress: ({ progress, renderedFrames, encodedFrames, stitchStage }) => {
          const pct = Math.round(progress * 100);
          if (pct !== lastLogged) {
            lastLogged = pct;
            console.log(
              `EXPORT_08_FRAME_PROGRESS rendered=${renderedFrames} encoded=${encodedFrames} total=${total} percent=${pct} stitchStage=${stitchStage ?? "rendering"}`,
            );
          }
          send({ type: "progress", progress, renderedFrames, totalFrames: total, stitchStage });
        },
      });
    } finally {
      clearInterval(ticker);
    }
    setStage("EXPORT_09_RENDER_MEDIA_RESOLVED");
    mem("after-render");

    if (!fs.existsSync(cfg.outputLocation)) throw new Error(`MP4 missing at ${cfg.outputLocation}`);
    const size = fs.statSync(cfg.outputLocation).size;
    if (size <= 0) throw new Error("MP4 is zero bytes");
    setStage("EXPORT_10_OUTPUT_EXISTS");
    console.log(`MP4_CREATED path=${cfg.outputLocation}`);
    console.log(`MP4_BYTES=${size}`);

    const probeRaw = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,width,height:format=duration,size",
        "-of",
        "json",
        cfg.outputLocation,
      ],
      { encoding: "utf8" },
    );
    const probe = JSON.parse(probeRaw);
    const video = (probe.streams ?? []).find((s) => s.codec_name === "h264");
    if (!video) throw new Error("ffprobe found no H.264 stream in the output");
    if (Number(video.width) !== composition.width || Number(video.height) !== composition.height) {
      throw new Error(
        `ffprobe size mismatch: got ${video.width}x${video.height}, expected ${composition.width}x${composition.height}`,
      );
    }
    fs.accessSync(cfg.outputLocation, fs.constants.R_OK);
    setStage("EXPORT_11_FFPROBE_VALID");
    console.log(`MP4_CODEC=${video.codec_name}`);
    console.log(`MP4_WIDTH=${video.width}`);
    console.log(`MP4_HEIGHT=${video.height}`);
    console.log(`MP4_DURATION=${probe.format?.duration}`);
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(
      `RENDER_TIMING seconds=${seconds} frames=${total} fps=${(total / Math.max(seconds, 1)).toFixed(2)}`,
    );
    mem("child-complete");
    send({
      type: "done",
      file: cfg.outputLocation,
      probe: {
        bytes: size,
        codec: video.codec_name,
        width: Number(video.width),
        height: Number(video.height),
        duration: Number(probe.format?.duration ?? 0),
        seconds,
      },
    });
  } finally {
    try {
      await browser.close({ silent: true });
      console.log("BROWSER_CLOSED");
    } catch (err) {
      console.error(`BROWSER_ERROR close ${err?.stack ?? err}`);
    }
  }
}

main()
  .then(() => {
    setTimeout(() => process.exit(0), 250);
  })
  .catch((err) => {
    console.error(`EXPORT_FAILED_STAGE=${stage}`);
    console.error(`ERROR=${err?.message ?? err}`);
    console.error(`STACK=${err?.stack ?? "n/a"}`);
    mem("child-error");
    send({ type: "error", message: String(err?.message ?? err), stack: String(err?.stack ?? ""), stage });
    setTimeout(() => process.exit(1), 250);
  });

process.on("uncaughtException", (err) => {
  console.error(`EXPORT_FAILED_STAGE=${stage}`);
  console.error(`ERROR=${err?.message ?? err}`);
  console.error(`STACK=${err?.stack ?? "n/a"}`);
  send({ type: "error", message: String(err?.message ?? err), stack: String(err?.stack ?? ""), stage });
  setTimeout(() => process.exit(1), 250);
});
process.on("unhandledRejection", (err) => {
  console.error(`CHILD_UNHANDLED_REJECTION ${err?.stack ?? err}`);
});
