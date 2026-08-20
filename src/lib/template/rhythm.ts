/** Rhythm patterns return relative shot lengths that add up to ~1. */
export interface RhythmPattern {
  key: string;
  label: string;
  description: string;
  weights: (n: number) => number[];
  /** preferred shot count for a 10s edit */
  density: number;
}

const norm = (a: number[]) => {
  const s = a.reduce((x, y) => x + y, 0);
  return a.map((x) => x / s);
};

const seq = (n: number, fn: (i: number, n: number) => number) =>
  norm(Array.from({ length: n }, (_, i) => fn(i, n)));

export const RHYTHMS: RhythmPattern[] = [
  {
    key: "rapid_burst",
    label: "rapid burst",
    description: "a wall of very short shots, then air",
    density: 14,
    weights: (n) => seq(n, (i, t) => (i < t * 0.6 ? 0.5 : 1.8)),
  },
  {
    key: "accelerating",
    label: "accelerating cuts",
    description: "shots get shorter and shorter",
    density: 11,
    weights: (n) => seq(n, (i, t) => 2.4 - (i / Math.max(t - 1, 1)) * 1.9),
  },
  {
    key: "decelerating",
    label: "decelerating cuts",
    description: "fast opening resolving into long holds",
    density: 10,
    weights: (n) => seq(n, (i, t) => 0.5 + (i / Math.max(t - 1, 1)) * 2.2),
  },
  {
    key: "slow_fast_slow",
    label: "slow → fast → slow",
    description: "settle, spike, settle",
    density: 10,
    weights: (n) => seq(n, (i, t) => 1.9 - Math.sin((i / Math.max(t - 1, 1)) * Math.PI) * 1.4),
  },
  {
    key: "fast_slow_fast",
    label: "fast → slow → fast",
    description: "burst, breathe, burst",
    density: 11,
    weights: (n) => seq(n, (i, t) => 0.6 + Math.sin((i / Math.max(t - 1, 1)) * Math.PI) * 1.6),
  },
  {
    key: "alternating",
    label: "alternating short / long",
    description: "call and response cutting",
    density: 10,
    weights: (n) => seq(n, (i) => (i % 2 === 0 ? 0.55 : 1.7)),
  },
  {
    key: "double_hit",
    label: "double hit",
    description: "pairs of hard cuts landing together",
    density: 12,
    weights: (n) => seq(n, (i) => (i % 3 === 2 ? 1.8 : 0.55)),
  },
  {
    key: "triple_hit",
    label: "triple hit",
    description: "three-shot punches punctuating holds",
    density: 13,
    weights: (n) => seq(n, (i) => (i % 4 === 3 ? 2.1 : 0.5)),
  },
  {
    key: "fake_pause",
    label: "fake pause",
    description: "an unexpected stop mid-edit",
    density: 10,
    weights: (n) => seq(n, (i, t) => (i === Math.floor(t * 0.55) ? 3.2 : 0.8)),
  },
  {
    key: "build_release",
    label: "build and release",
    description: "tightening cuts released by a hero hold",
    density: 11,
    weights: (n) => seq(n, (i, t) => (i === t - 1 ? 3.4 : 1.6 - (i / Math.max(t - 1, 1)) * 1.1)),
  },
  {
    key: "microcut_open",
    label: "microcut opening",
    description: "three micro shots then normal rhythm",
    density: 10,
    weights: (n) => seq(n, (i) => (i < 3 ? 0.35 : 1.5)),
  },
  {
    key: "breathing_middle",
    label: "breathing middle",
    description: "tight ends, spacious centre",
    density: 9,
    weights: (n) => seq(n, (i, t) => 0.6 + Math.sin((i / Math.max(t - 1, 1)) * Math.PI) * 1.9),
  },
  {
    key: "hero_hold",
    label: "hero hold",
    description: "even cutting resolving into one long product frame",
    density: 8,
    weights: (n) => seq(n, (i, t) => (i === t - 1 ? 4 : 1)),
  },
];

export const rhythmByKey = (key: string) =>
  RHYTHMS.find((r) => r.key === key) ?? RHYTHMS[0]!;
