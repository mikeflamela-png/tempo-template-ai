/**
 * GOLD STANDARDS
 *
 * Reference videos the user admires. We analyse them with a small hidden
 * <video>+<canvas> sampler (no external deps) to extract editing signals —
 * cut frequency, shot length distribution, motion & film-texture proxies —
 * then let the user tag what they like about each one. `aggregateSignals()`
 * folds every gold standard into a single "this is what good looks like"
 * fingerprint that the taste profile and generator can lean on.
 */
import { useSyncExternalStore } from "react";
import { deleteBlob, getBlob, putBlob } from "@/lib/brand/db";

export type LikeTag =
  | "overall feel"
  | "pacing"
  | "typography"
  | "opening"
  | "ending"
  | "motion"
  | "graphics"
  | "film treatment"
  | "restraint"
  | "product treatment"
  | "layout"
  | "social-native feel"
  | "sound design";

export const LIKE_TAGS: LikeTag[] = [
  "overall feel",
  "pacing",
  "typography",
  "opening",
  "ending",
  "motion",
  "graphics",
  "film treatment",
  "restraint",
  "product treatment",
  "layout",
  "social-native feel",
  "sound design",
];

export interface GoldSignals {
  shotDurationMean: number;
  shotDurationMedian: number;
  shotDurationP10: number;
  shotDurationP90: number;
  cutFrequency: number; // cuts per second
  microcutRatio: number; // fraction of shots < 0.5s
  holdRatio: number; // fraction of shots > 2s
  effectDensityProxy: number; // 0-1, variance-driven proxy for effect/graphics density
  textFrequencyProxy: number; // 0-1, high-frequency luma edges proxy for on-screen text
  motionAmount: number; // 0-1, mean frame-to-frame delta
  filmTextureAmount: number; // 0-1, high-frequency luma noise proxy (grain)
  openingPace: number; // cuts/sec in first 2s
  endingPace: number; // cuts/sec in last 2s
  densityCurve: number[]; // normalized 0-1 activity across the timeline (~24 buckets)
}

export interface GoldStandard {
  id: string;
  name: string;
  fileName: string;
  notes: string;
  likes: LikeTag[];
  signals: GoldSignals;
  createdAt: number;
  url?: string;
}

const KEY = "tempo.taste.goldStandards.v1";

interface GoldState {
  items: GoldStandard[];
}

const empty: GoldState = { items: [] };
let state: GoldState = empty;
let hydrated = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ items: state.items.map(({ url: _url, ...rest }) => rest) }),
    );
  } catch {
    /* ignore */
  }
}

function commit(next: GoldState) {
  state = next;
  persist();
  notify();
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...empty, ...(JSON.parse(raw) as GoldState) };
  } catch {
    /* ignore */
  }
  void (async () => {
    for (const item of state.items) {
      const blob = await getBlob(item.id);
      if (blob) item.url = URL.createObjectURL(blob);
    }
    notify();
  })();
}

export function useGoldStandards() {
  hydrate();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => empty,
  );
}

export function goldStandardsSnapshot(): GoldStandard[] {
  hydrate();
  return state.items;
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`;

const emptySignals: GoldSignals = {
  shotDurationMean: 0,
  shotDurationMedian: 0,
  shotDurationP10: 0,
  shotDurationP90: 0,
  cutFrequency: 0,
  microcutRatio: 0,
  holdRatio: 0,
  effectDensityProxy: 0,
  textFrequencyProxy: 0,
  motionAmount: 0,
  filmTextureAmount: 0,
  openingPace: 0,
  endingPace: 0,
  densityCurve: [],
};

/**
 * Samples a video at ~8fps at a small resolution using a hidden <video> +
 * <canvas>, computes frame-to-frame luma differences, detects cuts as sharp
 * spikes in that difference signal, and derives shot/motion/texture proxies.
 */
async function analyzeVideoFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<GoldSignals> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("could not read video metadata"));
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
    const W = 64;
    const H = 36;
    const fps = 8;
    const frameCount = Math.max(4, Math.min(400, Math.round(duration * fps)));

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas 2d context unavailable");

    const lumaFrames: Float32Array[] = [];
    const frameDelta: number[] = [];
    const highFreq: number[] = [];

    for (let i = 0; i < frameCount; i++) {
      const t = Math.min(duration - 0.001, (i / frameCount) * duration);
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = t;
      });
      ctx.drawImage(video, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);
      const luma = new Float32Array(W * H);
      for (let p = 0; p < W * H; p++) {
        const o = p * 4;
        luma[p] = 0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!;
      }
      lumaFrames.push(luma);

      // high-frequency proxy: horizontal gradient energy (texture / text edges)
      let edgeEnergy = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 1; x < W; x++) {
          edgeEnergy += Math.abs(luma[y * W + x]! - luma[y * W + x - 1]!);
        }
      }
      highFreq.push(edgeEnergy / (W * H));

      if (lumaFrames.length > 1) {
        const prev = lumaFrames[lumaFrames.length - 2]!;
        let diff = 0;
        for (let p = 0; p < luma.length; p++) diff += Math.abs(luma[p]! - prev[p]!);
        frameDelta.push(diff / (W * H));
      }

      onProgress?.(Math.round(((i + 1) / frameCount) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }

    const meanDelta = frameDelta.reduce((a, b) => a + b, 0) / Math.max(1, frameDelta.length);
    const sortedDelta = [...frameDelta].sort((a, b) => a - b);
    const cutThreshold = Math.max(
      meanDelta * 3.2,
      (sortedDelta[Math.floor(sortedDelta.length * 0.9)] ?? meanDelta) * 1.1,
      6,
    );

    // detect cut frame indices
    const cutIdx: number[] = [0];
    for (let i = 0; i < frameDelta.length; i++) {
      if (frameDelta[i]! > cutThreshold) cutIdx.push(i + 1);
    }
    cutIdx.push(frameCount);

    const shotDurations: number[] = [];
    for (let i = 1; i < cutIdx.length; i++) {
      const frames = cutIdx[i]! - cutIdx[i - 1]!;
      shotDurations.push((frames / frameCount) * duration);
    }
    const validShots = shotDurations.filter((d) => d > 0);
    const sortedShots = [...validShots].sort((a, b) => a - b);
    const pct = (p: number) =>
      sortedShots.length ? sortedShots[Math.min(sortedShots.length - 1, Math.floor(p * sortedShots.length))]! : 0;

    const mean = validShots.reduce((a, b) => a + b, 0) / Math.max(1, validShots.length);
    const median = pct(0.5);
    const cuts = cutIdx.length - 2;
    const cutFrequency = duration > 0 ? cuts / duration : 0;
    const microcutRatio = validShots.length ? validShots.filter((d) => d < 0.5).length / validShots.length : 0;
    const holdRatio = validShots.length ? validShots.filter((d) => d > 2).length / validShots.length : 0;

    const varDelta =
      frameDelta.reduce((a, b) => a + (b - meanDelta) ** 2, 0) / Math.max(1, frameDelta.length);
    const motionAmount = clamp01(meanDelta / 40);
    const effectDensityProxy = clamp01(Math.sqrt(varDelta) / 40);

    const meanHF = highFreq.reduce((a, b) => a + b, 0) / Math.max(1, highFreq.length);
    const textFrequencyProxy = clamp01(meanHF / 25);
    const filmTextureAmount = clamp01((meanHF % 25) / 25 + effectDensityProxy * 0.2);

    const openingWindow = Math.max(1, Math.round((2 / duration) * frameCount));
    const openingCuts = cutIdx.filter((c) => c > 0 && c <= openingWindow).length;
    const openingPace = openingCuts / Math.min(2, duration);
    const endingCuts = cutIdx.filter((c) => c >= frameCount - openingWindow && c < frameCount).length;
    const endingPace = endingCuts / Math.min(2, duration);

    const buckets = 24;
    const densityCurve: number[] = new Array(buckets).fill(0);
    const bucketCounts: number[] = new Array(buckets).fill(0);
    frameDelta.forEach((d, i) => {
      const b = Math.min(buckets - 1, Math.floor((i / frameDelta.length) * buckets));
      densityCurve[b] += d;
      bucketCounts[b] += 1;
    });
    const maxBucket = Math.max(1, ...densityCurve.map((v, i) => (bucketCounts[i] ? v / bucketCounts[i] : 0)));
    for (let i = 0; i < buckets; i++) {
      densityCurve[i] = bucketCounts[i] ? clamp01((densityCurve[i]! / bucketCounts[i]!) / maxBucket) : 0;
    }

    return {
      shotDurationMean: mean,
      shotDurationMedian: median,
      shotDurationP10: pct(0.1),
      shotDurationP90: pct(0.9),
      cutFrequency,
      microcutRatio,
      holdRatio,
      effectDensityProxy,
      textFrequencyProxy,
      motionAmount,
      filmTextureAmount,
      openingPace,
      endingPace,
      densityCurve,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

export async function addGoldStandard(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<GoldStandard> {
  hydrate();
  const id = uid("gold");
  await putBlob(id, file);
  const signals = await analyzeVideoFile(file, onProgress).catch(() => emptySignals);
  const item: GoldStandard = {
    id,
    name: file.name.replace(/\.[^.]+$/, ""),
    fileName: file.name,
    notes: "",
    likes: [],
    signals,
    createdAt: Date.now(),
    url: URL.createObjectURL(file),
  };
  commit({ items: [item, ...state.items] });
  return item;
}

export function updateGoldStandard(id: string, patch: Partial<GoldStandard>) {
  hydrate();
  commit({ items: state.items.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
}

export function deleteGoldStandard(id: string) {
  hydrate();
  void deleteBlob(id);
  commit({ items: state.items.filter((g) => g.id !== id) });
}

/** Averages preference signals across every stored gold standard. */
export function aggregateSignals(): GoldSignals | null {
  hydrate();
  const items = state.items;
  if (!items.length) return null;
  const n = items.length;
  const sum = (f: (s: GoldSignals) => number) => items.reduce((a, g) => a + f(g.signals), 0) / n;
  const curveLen = Math.max(1, ...items.map((g) => g.signals.densityCurve.length || 1));
  const densityCurve = new Array(curveLen).fill(0).map((_, i) => {
    const vals = items.map((g) => g.signals.densityCurve[i] ?? 0);
    return vals.reduce((a, b) => a + b, 0) / n;
  });
  return {
    shotDurationMean: sum((s) => s.shotDurationMean),
    shotDurationMedian: sum((s) => s.shotDurationMedian),
    shotDurationP10: sum((s) => s.shotDurationP10),
    shotDurationP90: sum((s) => s.shotDurationP90),
    cutFrequency: sum((s) => s.cutFrequency),
    microcutRatio: sum((s) => s.microcutRatio),
    holdRatio: sum((s) => s.holdRatio),
    effectDensityProxy: sum((s) => s.effectDensityProxy),
    textFrequencyProxy: sum((s) => s.textFrequencyProxy),
    motionAmount: sum((s) => s.motionAmount),
    filmTextureAmount: sum((s) => s.filmTextureAmount),
    openingPace: sum((s) => s.openingPace),
    endingPace: sum((s) => s.endingPace),
    densityCurve,
  };
}
