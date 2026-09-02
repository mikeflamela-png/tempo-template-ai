/**
 * LIGHTWEIGHT SHOT DETECTION
 *
 * No AI, no vision model. The video is played back fast and each sampled frame
 * is reduced to a tiny grayscale signature; a large frame-to-frame delta means
 * "shot A ended, shot B began". Cheap, deterministic, entirely client side.
 */

const GW = 32;
const GH = 18;

export interface DetectOptions {
  minShot?: number;
  sensitivity?: number; // 0..1, higher = more cuts
  onProgress?: (fraction: number) => void;
  signal?: { cancelled: boolean };
}

interface Sample {
  time: number;
  sig: Float32Array;
}

/** Tiny RGB signature — colour beats luma, two shots can share brightness. */
function signature(ctx: CanvasRenderingContext2D): Float32Array {
  const { data } = ctx.getImageData(0, 0, GW, GH);
  const out = new Float32Array(GW * GH * 3);
  for (let i = 0; i < GW * GH; i++) {
    const p = i * 4;
    out[i * 3] = (data[p] ?? 0) / 255;
    out[i * 3 + 1] = (data[p + 1] ?? 0) / 255;
    out[i * 3 + 2] = (data[p + 2] ?? 0) / 255;
  }
  return out;
}

function delta(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return sum / a.length;
}

function median(values: number[]) {
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : ((s[mid - 1]! + s[mid]!) / 2);
}

export async function loadVideo(url: string): Promise<HTMLVideoElement> {
  const v = document.createElement("video");
  v.src = url;
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    const ok = () => resolve();
    v.onloadedmetadata = ok;
    v.onerror = () => reject(new Error("Could not read this video file"));
  });
  if (!Number.isFinite(v.duration) || v.duration <= 0) {
    // Some webm/mp4 files report Infinity until seeked
    await new Promise<void>((resolve) => {
      v.currentTime = 1e6;
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        v.currentTime = 0;
        resolve();
      };
      setTimeout(resolve, 1500);
    });
  }
  return v;
}

/** Grabs a jpeg data url at a given time. */
export async function grabThumb(
  video: HTMLVideoElement,
  time: number,
  width = 320,
): Promise<string> {
  await seek(video, time);
  const ratio = video.videoHeight / Math.max(1, video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.max(1, Math.round(width * (ratio || 0.5625)));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.62);
}

export function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const target = Math.max(0, Math.min(time, Math.max(0, (video.duration || 0) - 0.05)));
    if (Math.abs(video.currentTime - target) < 0.02 && video.readyState >= 2) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      resolve();
    };
    video.addEventListener("seeked", finish);
    video.currentTime = target;
    setTimeout(finish, 3000);
  });
}

/**
 * Returns cut times (seconds) inside the video, excluding 0 and the end.
 */
export async function detectCuts(url: string, opts: DetectOptions = {}): Promise<{
  cuts: number[];
  duration: number;
}> {
  const minShot = opts.minShot ?? 0.7;
  const sensitivity = opts.sensitivity ?? 0.5;
  const video = await loadVideo(url);
  const duration = video.duration || 0;
  const canvas = document.createElement("canvas");
  canvas.width = GW;
  canvas.height = GH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { cuts: [], duration };

  const samples: Sample[] = [];
  const step = duration > 600 ? 0.5 : duration > 180 ? 0.35 : 0.25;

  // Fast path: play the video at high speed and sample rendered frames.
  const fast = typeof (video as unknown as { requestVideoFrameCallback?: unknown })
    .requestVideoFrameCallback === "function";

  if (fast) {
    await new Promise<void>((resolve) => {
      let last = -1;
      const vfc = (
        video as unknown as {
          requestVideoFrameCallback: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
        }
      ).requestVideoFrameCallback.bind(video);
      const tick = (_now: number, meta: { mediaTime: number }) => {
        if (opts.signal?.cancelled) return resolve();
        const t = meta.mediaTime;
        if (t - last >= step - 0.01) {
          last = t;
          ctx.drawImage(video, 0, 0, GW, GH);
          samples.push({ time: t, sig: signature(ctx) });
          opts.onProgress?.(Math.min(0.98, t / Math.max(0.1, duration)));
        }
        if (video.ended) return resolve();
        vfc(tick);
      };
      video.playbackRate = 16;
      video.muted = true;
      video.onended = () => resolve();
      void video.play().then(() => vfc(tick)).catch(() => resolve());
      // hard safety net
      setTimeout(resolve, Math.min(180000, 4000 + duration * 250));
    });
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  }

  // Fallback / top-up: seek sampling when playback sampling produced too little.
  if (samples.length < Math.min(20, duration / step / 4)) {
    samples.length = 0;
    for (let t = 0; t < duration; t += step) {
      if (opts.signal?.cancelled) break;
      await seek(video, t);
      ctx.drawImage(video, 0, 0, GW, GH);
      samples.push({ time: t, sig: signature(ctx) });
      opts.onProgress?.(Math.min(0.98, t / Math.max(0.1, duration)));
    }
  }

  samples.sort((a, b) => a.time - b.time);

  const deltas: { time: number; d: number }[] = [];
  for (let i = 1; i < samples.length; i++) {
    deltas.push({ time: samples[i]!.time, d: delta(samples[i - 1]!.sig, samples[i]!.sig) });
  }
  if (!deltas.length) return { cuts: [], duration };

  const values = deltas.map((x) => x.d);
  // Robust statistics: the cuts themselves would inflate a mean/σ threshold.
  const med = median(values);
  const mad = median(values.map((v) => Math.abs(v - med))) || 0.004;
  // sensitivity 0 -> 10 MAD, 1 -> 2 MAD
  const threshold = Math.max(0.03, med + mad * (10 - sensitivity * 8));

  const cuts: number[] = [];
  let lastCut = 0;
  for (const d of deltas) {
    if (d.d >= threshold && d.time - lastCut >= minShot && duration - d.time >= minShot) {
      cuts.push(Number(d.time.toFixed(3)));
      lastCut = d.time;
    }
  }
  opts.onProgress?.(1);
  video.src = "";
  return { cuts, duration };
}
