/**
 * REFERENCE EDIT AUTOPSY
 *
 * Real, client-side visual analysis of an uploaded reference video. Samples
 * frames at low resolution onto a canvas, builds luma histograms/means per
 * frame, and derives cut points, shot lengths, pacing, and notable visual
 * events (flashes, freezes, black frames, microcut bursts, long holds).
 */

export interface FrameSample {
  t: number;
  meanLuma: number;
  diff: number;
}

export interface Shot {
  start: number;
  end: number;
  duration: number;
}

export interface ShotLengthBuckets {
  microcut: number; // <0.4s
  fast: number; // 0.4-1s
  medium: number; // 1-2.5s
  hold: number; // >2.5s
}

export interface PacingPoint {
  t: number;
  cutsPerSecond: number;
}

export interface VisualEvent {
  type: "flash" | "black" | "freeze" | "microcut_burst" | "long_hold";
  start: number;
  end: number;
  note: string;
}

export interface StructureSummary {
  cutCount: number;
  avgShotLength: number;
  events: VisualEvent[];
}

export interface ReferenceAnalysis {
  fileName: string;
  duration: number;
  frameRate: number;
  cuts: number[];
  shots: Shot[];
  shotLengthBuckets: ShotLengthBuckets;
  pacingCurve: PacingPoint[];
  visualEvents: VisualEvent[];
  densityCurve: { t: number; density: number }[];
  opening: StructureSummary;
  middle: StructureSummary;
  ending: StructureSummary;
}

export type AnalysisProgress = (pct: number, label: string) => void;

const SAMPLE_W = 64;
const SAMPLE_H = 36;
const SAMPLE_FPS = 10;

function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error("Could not load video"));
  });
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = Math.min(t, Math.max(0, video.duration - 0.03));
  });
}

function grabFrame(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
): { meanLuma: number; hist: number[]; variance: number } {
  ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
  const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
  const hist = new Array(16).fill(0);
  let sum = 0;
  let sumSq = 0;
  const n = SAMPLE_W * SAMPLE_H;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += luma;
    sumSq += luma * luma;
    const bucket = Math.min(15, Math.floor(luma / 16));
    hist[bucket] = (hist[bucket] ?? 0) + 1;
  }
  const meanLuma = sum / n / 255;
  const variance = Math.max(0, sumSq / n - (sum / n) * (sum / n)) / (255 * 255);
  return { meanLuma, hist, variance };
}

function histDiff(a: number[], b: number[], n: number): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    d += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }
  return d / (2 * n);
}

export async function analyzeReferenceVideo(
  file: File,
  onProgress?: AnalysisProgress,
): Promise<ReferenceAnalysis> {
  onProgress?.(2, "Loading video…");
  const video = await loadVideo(file);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration || duration <= 0) {
    URL.revokeObjectURL(video.src);
    throw new Error("Video has no readable duration");
  }

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas not supported");

  const step = 1 / SAMPLE_FPS;
  const times: number[] = [];
  for (let t = 0; t < duration; t += step) times.push(t);

  const samples: FrameSample[] = [];
  const densities: { t: number; density: number }[] = [];
  let prevHist: number[] | null = null;
  const n = SAMPLE_W * SAMPLE_H;

  for (let i = 0; i < times.length; i++) {
    const t = times[i] ?? 0;
    await seekTo(video, t);
    const { meanLuma, hist, variance } = grabFrame(video, ctx);
    const diff = prevHist ? histDiff(hist, prevHist, n) : 0;
    prevHist = hist;
    samples.push({ t, meanLuma, diff });
    densities.push({ t: Number(t.toFixed(2)), density: Number(variance.toFixed(4)) });
    if (i % 4 === 0) {
      onProgress?.(4 + Math.round((i / times.length) * 86), "Sampling frames…");
    }
  }
  URL.revokeObjectURL(video.src);

  onProgress?.(92, "Detecting cuts…");

  // adaptive threshold: mean + 2.2*std of diffs
  const diffs = samples.map((s) => s.diff);
  const mean = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
  const variance = diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, diffs.length);
  const std = Math.sqrt(variance);
  const threshold = Math.max(0.08, mean + 2.2 * std);

  const cuts: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    if (s && s.diff > threshold) cuts.push(Number(s.t.toFixed(2)));
  }
  // merge cuts that are too close together (<0.12s)
  const mergedCuts: number[] = [];
  for (const c of cuts) {
    const last = mergedCuts[mergedCuts.length - 1];
    if (last === undefined || c - last > 0.12) mergedCuts.push(c);
  }

  const boundaries = [0, ...mergedCuts, duration];
  const shots: Shot[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i] ?? 0;
    const end = boundaries[i + 1] ?? duration;
    if (end - start > 0.02) shots.push({ start, end, duration: Number((end - start).toFixed(2)) });
  }

  const shotLengthBuckets: ShotLengthBuckets = { microcut: 0, fast: 0, medium: 0, hold: 0 };
  for (const s of shots) {
    if (s.duration < 0.4) shotLengthBuckets.microcut++;
    else if (s.duration < 1) shotLengthBuckets.fast++;
    else if (s.duration < 2.5) shotLengthBuckets.medium++;
    else shotLengthBuckets.hold++;
  }

  // pacing curve: cuts per second in a sliding 1.5s window
  const window = 1.5;
  const pacingCurve: PacingPoint[] = [];
  for (let t = 0; t < duration; t += 0.25) {
    const inWindow = mergedCuts.filter((c) => c >= t - window / 2 && c <= t + window / 2).length;
    pacingCurve.push({ t: Number(t.toFixed(2)), cutsPerSecond: Number((inWindow / window).toFixed(2)) });
  }

  // visual events
  const visualEvents: VisualEvent[] = [];

  // black frames -> merge contiguous
  let blackStart: number | null = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!s) continue;
    const isBlack = s.meanLuma < 0.05;
    if (isBlack && blackStart === null) blackStart = s.t;
    if (!isBlack && blackStart !== null) {
      visualEvents.push({ type: "black", start: blackStart, end: s.t, note: "Black frame hold" });
      blackStart = null;
    }
  }

  // flash frames: sudden luma spike vs neighbors
  for (let i = 1; i < samples.length - 1; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    const next = samples[i + 1];
    if (!prev || !cur || !next) continue;
    const spike = cur.meanLuma - (prev.meanLuma + next.meanLuma) / 2;
    if (spike > 0.35) {
      visualEvents.push({ type: "flash", start: cur.t, end: cur.t + step, note: "Flash frame" });
    }
  }

  // freeze candidates: near-zero diff sustained over >0.5s
  let freezeStart: number | null = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!s) continue;
    const isFreeze = s.diff < 0.01;
    if (isFreeze && freezeStart === null) freezeStart = s.t;
    if ((!isFreeze || i === samples.length - 1) && freezeStart !== null) {
      const end = s.t;
      if (end - freezeStart > 0.5) {
        visualEvents.push({ type: "freeze", start: freezeStart, end, note: "Freeze / still hold" });
      }
      freezeStart = null;
    }
  }

  // microcut bursts: 3+ microcut shots in a row
  let burst: Shot[] = [];
  for (const s of shots) {
    if (s.duration < 0.4) {
      burst.push(s);
    } else {
      if (burst.length >= 3) {
        visualEvents.push({
          type: "microcut_burst",
          start: burst[0]!.start,
          end: burst[burst.length - 1]!.end,
          note: `${burst.length} rapid cuts`,
        });
      }
      burst = [];
    }
  }
  if (burst.length >= 3) {
    visualEvents.push({
      type: "microcut_burst",
      start: burst[0]!.start,
      end: burst[burst.length - 1]!.end,
      note: `${burst.length} rapid cuts`,
    });
  }

  // long holds
  for (const s of shots) {
    if (s.duration > 2.5) {
      visualEvents.push({ type: "long_hold", start: s.start, end: s.end, note: `${s.duration.toFixed(1)}s hold` });
    }
  }

  visualEvents.sort((a, b) => a.start - b.start);

  const summarize = (from: number, to: number): StructureSummary => {
    const segShots = shots.filter((s) => s.start >= from && s.start < to);
    const segCuts = mergedCuts.filter((c) => c >= from && c < to).length;
    const avg = segShots.length ? segShots.reduce((a, b) => a + b.duration, 0) / segShots.length : 0;
    const events = visualEvents.filter((e) => e.start >= from && e.start < to);
    return { cutCount: segCuts, avgShotLength: Number(avg.toFixed(2)), events };
  };

  const third = duration / 3;
  const opening = summarize(0, third);
  const middle = summarize(third, third * 2);
  const ending = summarize(third * 2, duration);

  onProgress?.(100, "Done");

  return {
    fileName: file.name,
    duration: Number(duration.toFixed(2)),
    frameRate: SAMPLE_FPS,
    cuts: mergedCuts,
    shots,
    shotLengthBuckets,
    pacingCurve,
    visualEvents,
    densityCurve: densities,
    opening,
    middle,
    ending,
  };
}
