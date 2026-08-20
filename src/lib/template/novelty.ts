/**
 * Session novelty memory. Tracks what recent generations already explored so
 * repeated presses of Generate keep moving into new creative territory.
 */
const memory = {
  concepts: [] as string[],
  rhythms: [] as string[],
  layouts: [] as string[],
  fonts: [] as string[],
  transitions: [] as string[],
  motifs: [] as string[],
};

type Bucket = keyof typeof memory;
const LIMIT = 24;

export function remember(bucket: Bucket, value: string) {
  const list = memory[bucket];
  list.unshift(value);
  if (list.length > LIMIT) list.length = LIMIT;
}

/** 0 = brand new, 1 = used in the very last generation. */
export function recency(bucket: Bucket, value: string) {
  const i = memory[bucket].indexOf(value);
  if (i === -1) return 0;
  return 1 - i / LIMIT;
}

/** Higher is better: prefers combinations we have not explored recently. */
export function noveltyScore(parts: Partial<Record<Bucket, string>>) {
  let penalty = 0;
  (Object.keys(parts) as Bucket[]).forEach((b) => {
    const v = parts[b];
    if (v) penalty += recency(b, v);
  });
  return -penalty;
}

export function pickNovel<T>(
  bucket: Bucket,
  options: readonly T[],
  keyOf: (t: T) => string,
  rng: () => number,
): T {
  let best: T = options[0]!;
  let bestScore = -Infinity;
  for (const o of options) {
    const score = -recency(bucket, keyOf(o)) * 1.6 + rng() * 0.9;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  remember(bucket, keyOf(best));
  return best;
}

export function resetNovelty() {
  (Object.keys(memory) as Bucket[]).forEach((b) => (memory[b].length = 0));
}
