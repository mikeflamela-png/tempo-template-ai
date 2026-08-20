import type { BeatEvent, BeatMap } from "@/lib/template/types";

/**
 * Real client-side music analysis: spectral-flux onset detection + autocorrelation
 * tempo estimate, then classification of the detected events into a musical map.
 * No external service, runs on the decoded PCM in the browser.
 */

export interface AnalysisResult {
  beatMap: BeatMap;
  /** downsampled peaks for waveform drawing */
  peaks: number[];
}

const FRAME = 1024;
const HOP = 512;

export async function analyseAudio(file: File | Blob, peakCount = 900): Promise<AnalysisResult> {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error("Web Audio is not available in this browser");
  const ctx = new AudioCtx();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const data = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const peaks = downsample(data, peakCount);
    const { flux, times } = spectralFlux(data, sr);
    const onsets = pickOnsets(flux, times);
    const bpm = estimateBpm(onsets.map((o) => o.time));
    const events = classify(onsets, bpm, buf.duration, flux, times);
    return {
      peaks,
      beatMap: {
        bpm,
        confidence: onsets.length > 8 ? 0.8 : 0.4,
        duration: buf.duration,
        events,
      },
    };
  } finally {
    void ctx.close();
  }
}

function downsample(data: Float32Array, count: number) {
  const block = Math.max(1, Math.floor(data.length / count));
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    let peak = 0;
    const start = i * block;
    for (let j = start; j < start + block && j < data.length; j += 4) {
      const v = Math.abs(data[j] ?? 0);
      if (v > peak) peak = v;
    }
    out.push(peak);
  }
  const max = Math.max(...out, 0.0001);
  return out.map((v) => v / max);
}

/** Magnitude-domain flux using a cheap Goertzel-free FFT (radix-2). */
function spectralFlux(data: Float32Array, sr: number) {
  const win = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1));

  const flux: number[] = [];
  const times: number[] = [];
  let prev = new Float32Array(FRAME / 2);
  const re = new Float32Array(FRAME);
  const im = new Float32Array(FRAME);

  for (let pos = 0; pos + FRAME < data.length; pos += HOP) {
    for (let i = 0; i < FRAME; i++) {
      re[i] = (data[pos + i] ?? 0) * (win[i] ?? 0);
      im[i] = 0;
    }
    fft(re, im);
    let sum = 0;
    const mag = new Float32Array(FRAME / 2);
    for (let k = 0; k < FRAME / 2; k++) {
      const m = Math.hypot(re[k] ?? 0, im[k] ?? 0);
      mag[k] = m;
      const d = m - (prev[k] ?? 0);
      if (d > 0) sum += d;
    }
    prev = mag;
    flux.push(sum);
    times.push(pos / sr);
  }
  return { flux, times };
}

function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ur = re[i + k] ?? 0;
        const ui = im[i + k] ?? 0;
        const vr = (re[i + k + len / 2] ?? 0) * wr - (im[i + k + len / 2] ?? 0) * wi;
        const vi = (re[i + k + len / 2] ?? 0) * wi + (im[i + k + len / 2] ?? 0) * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

interface Onset {
  time: number;
  strength: number;
}

function pickOnsets(flux: number[], times: number[]): Onset[] {
  const w = 20;
  const out: Onset[] = [];
  const mean = flux.reduce((a, b) => a + b, 0) / Math.max(1, flux.length);
  let last = -1;
  for (let i = w; i < flux.length - w; i++) {
    const v = flux[i] ?? 0;
    let local = 0;
    for (let j = i - w; j <= i + w; j++) local += flux[j] ?? 0;
    local /= w * 2 + 1;
    const t = times[i] ?? 0;
    if (v > local * 1.35 && v > mean * 0.8 && t - last > 0.12) {
      const peak = v >= (flux[i - 1] ?? 0) && v >= (flux[i + 1] ?? 0);
      if (peak) {
        out.push({ time: Number(t.toFixed(3)), strength: v / Math.max(local, 0.0001) });
        last = t;
      }
    }
  }
  return out;
}

function estimateBpm(times: number[]) {
  if (times.length < 4) return 120;
  const iois: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const d = (times[i] ?? 0) - (times[i - 1] ?? 0);
    if (d > 0.2 && d < 2) iois.push(d);
  }
  if (!iois.length) return 120;
  // histogram over BPM buckets
  const buckets = new Map<number, number>();
  for (const d of iois) {
    let bpm = 60 / d;
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    const key = Math.round(bpm);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  let best = 120;
  let bestCount = 0;
  for (const [bpm, count] of buckets) {
    if (count > bestCount) {
      best = bpm;
      bestCount = count;
    }
  }
  return best;
}

function classify(
  onsets: Onset[],
  bpm: number,
  duration: number,
  flux: number[],
  times: number[],
): BeatEvent[] {
  const beat = 60 / bpm;
  const bar = beat * 4;
  const phrase = bar * 4;
  const events: BeatEvent[] = [];
  const maxStrength = Math.max(...onsets.map((o) => o.strength), 1);

  for (const o of onsets) {
    const inBar = o.time % bar;
    const norm = o.strength / maxStrength;
    let kind: BeatEvent["kind"] = "transient";
    if (inBar < beat * 0.18 || bar - inBar < beat * 0.18) kind = "downbeat";
    else if (Math.abs((o.time % beat) - 0) < 0.07 || beat - (o.time % beat) < 0.07)
      kind = norm > 0.6 ? "strongBeat" : "minorBeat";
    events.push({ time: o.time, kind, strength: Number(norm.toFixed(3)) });
  }

  // phrase changes on the grid
  for (let t = phrase; t < duration; t += phrase) {
    events.push({ time: Number(t.toFixed(3)), kind: "phraseChange", strength: 0.8 });
  }

  // energy shifts / drop from a smoothed flux envelope
  const win = Math.max(4, Math.round(1 / ((times[1] ?? 0.01) - (times[0] ?? 0) || 0.01)));
  const env: number[] = [];
  for (let i = 0; i < flux.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win && j < flux.length; j++) s += flux[j] ?? 0;
    env.push(s / win);
  }
  const envMax = Math.max(...env, 0.0001);
  let biggestJump = 0;
  let dropTime = 0;
  for (let i = 1; i < env.length; i++) {
    const jump = ((env[i] ?? 0) - (env[i - 1] ?? 0)) / envMax;
    const t = (times[i * win] ?? i) as number;
    if (jump > 0.18) {
      events.push({ time: Number(t.toFixed(3)), kind: "energyShift", strength: Math.min(1, jump) });
      if (jump > biggestJump) {
        biggestJump = jump;
        dropTime = t;
      }
    }
  }
  if (biggestJump > 0.2) {
    events.push({ time: Number(dropTime.toFixed(3)), kind: "drop", strength: 1 });
  }

  return events.sort((a, b) => a.time - b.time);
}

export const EVENT_WEIGHT: Record<BeatEvent["kind"], number> = {
  minorBeat: 0.25,
  strongBeat: 0.6,
  transient: 0.4,
  downbeat: 0.85,
  phraseChange: 0.9,
  energyShift: 0.8,
  drop: 1,
};
