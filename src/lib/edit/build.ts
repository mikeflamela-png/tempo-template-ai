import type {
  BeatMap,
  MediaMap,
  MediaSlot,
  Overlay,
  OverlayType,
  Purpose,
  TemplateSpec,
  TextSlot,
} from "@/lib/template/types";
import type {
  Clip,
  EditVersion,
  MakeSettings,
  Scene,
  ShotType,
  TextSettings,
} from "@/lib/footage/types";
import { FORMATS, clipLength } from "@/lib/footage/types";
import { cachedUrl } from "@/lib/footage/db";
import { recipeByKey, simpleStyleFor, type EditRecipe } from "./recipes";


/* ------------------------------------------------------------------ rng */

export function rng(seed: number) {
  let s = (seed * 2654435761) % 4294967296 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/* ------------------------------------------------------- clip scoring */

const RATING_WEIGHT: Record<number, number> = {
  0: 2, // unrated — usable, but the rated stuff wins
  1: 0.15,
  2: 0.6,
  3: 2.5,
  4: 6,
  5: 10,
};

export interface ScoreContext {
  need: number;
  wantType: ShotType | null;
  used: Record<string, number>;
  previousClipId?: string | undefined;
  previousSourceId?: string | undefined;
  /** scene we're currently inside — clips from it are strongly preferred */
  sceneId?: string | null | undefined;
  /** scenes already used, so a new scene is fresh rather than a repeat */
  usedScenes?: Record<string, number> | undefined;
}

/** Deterministic weighted score. Rejected clips are impossible to select. */
export function scoreClip(clip: Clip, ctx: ScoreContext): number {
  if (clip.rejected) return 0;
  let score = RATING_WEIGHT[clip.rating] ?? 2;
  if (clip.favorite) score *= 1.9;

  if (ctx.wantType && clip.shotType) {
    score *= clip.shotType === ctx.wantType ? 2.4 : 0.8;
  }

  // scene continuity: staying inside a scene reads as a deliberate sequence
  if (ctx.sceneId) {
    if (clip.sceneId === ctx.sceneId) score *= 3.2;
    else score *= 0.55;
  } else if (clip.sceneId && ctx.usedScenes) {
    const seen = ctx.usedScenes[clip.sceneId] ?? 0;
    if (seen > 0) score *= 0.7 ** Math.min(seen, 4);
  }

  const usable = clipLength(clip);
  if (usable < ctx.need) score *= Math.max(0.03, (usable / ctx.need) ** 2);
  else if (usable > ctx.need * 8) score *= 0.9;

  const uses = ctx.used[clip.id] ?? 0;
  score *= 0.22 ** uses;
  if (ctx.previousClipId === clip.id) score *= 0.02;
  if (ctx.previousSourceId && ctx.previousSourceId === clip.sourceId) score *= 0.92;

  return score;
}


function weightedPick(clips: Clip[], ctx: ScoreContext, rand: () => number): Clip | null {
  const scored = clips.map((c) => ({ c, s: scoreClip(c, ctx) })).filter((x) => x.s > 0);
  if (!scored.length) return null;
  const total = scored.reduce((a, b) => a + b.s, 0);
  let t = rand() * total;
  for (const x of scored) {
    t -= x.s;
    if (t <= 0) return x.c;
  }
  return scored[scored.length - 1]!.c;
}

/** Ranked alternatives for a slot — used by SWAP. */
export function alternativesFor(
  clips: Clip[],
  ctx: ScoreContext,
  limit = 6,
  excludeId?: string,
): Clip[] {
  return clips
    .filter((c) => !c.rejected && c.id !== excludeId)
    .map((c) => ({ c, s: scoreClip(c, { ...ctx, used: {} }) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c);
}

/* --------------------------------------------------------- shot timing */

const EVENT_RANK: Record<string, number> = {
  drop: 5,
  phraseChange: 4.5,
  downbeat: 4,
  energyShift: 3.5,
  strongBeat: 3,
  transient: 2,
  minorBeat: 1,
};

function beatTimes(beatMap: BeatMap | null): number[] {
  if (!beatMap) return [];
  return beatMap.events
    .filter((e) => e.kind !== "minorBeat" || e.strength > 0.25)
    .map((e) => e.time)
    .sort((a, b) => a - b);
}

/** Musically significant moments, strongest first in rank, sorted by time. */
function cutCandidates(beatMap: BeatMap | null, minRank: number): number[] {
  if (!beatMap) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const e of [...beatMap.events].sort((a, b) => a.time - b.time)) {
    if ((EVENT_RANK[e.kind] ?? 0) < minRank) continue;
    const t = Number(e.time.toFixed(3));
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * CUT PLAN — the music leads.
 *
 * When a track exists, cuts land ON detected beats/transients: we walk the
 * musical grid and take the event closest to the style's target shot length,
 * so pacing still differs per style but every cut is on the music. Without
 * music we fall back to the styled pacing curve.
 */
export function planCuts(
  recipe: EditRecipe,
  total: number,
  beatMap: BeatMap | null,
  rand: () => number,
): number[] {
  const base = recipe.avgShot;

  const target = (i: number, n: number) => {
    const p = n <= 1 ? 0 : i / (n - 1);
    return base * (1 + recipe.accelerate * (0.45 - p * 0.9));
  };

  // ---- musical path ------------------------------------------------------
  if (beatMap && recipe.beatSync > 0.05) {
    // relax the significance floor until we have enough places to cut
    let events: number[] = [];
    for (const rank of [4, 3, 2, 1]) {
      events = cutCandidates(beatMap, rank).filter((t) => t > 0.2 && t < total - 0.25);
      if (events.length >= Math.max(3, total / base / 1.4)) break;
    }
    if (events.length >= 3) {
      const n = Math.max(3, Math.round(total / base));
      const bounds: number[] = [];
      let cursor = 0;
      let i = 0;
      while (cursor < total - base * 0.6 && bounds.length < n * 2) {
        const want = cursor + target(i, n) * (0.9 + rand() * 0.2);
        let best = -1;
        let bestD = Infinity;
        for (const e of events) {
          if (e <= cursor + Math.max(0.28, base * 0.4)) continue;
          const d = Math.abs(e - want);
          if (d < bestD) {
            bestD = d;
            best = e;
          }
        }
        if (best < 0 || best >= total - 0.25) break;
        bounds.push(best);
        cursor = best;
        i++;
      }
      if (bounds.length >= 2) {
        const durations: number[] = [];
        let prev = 0;
        for (const b of bounds) {
          durations.push(Number((b - prev).toFixed(3)));
          prev = b;
        }
        const tail = Number((total - prev).toFixed(3));
        if (tail < 0.3 && durations.length) {
          durations[durations.length - 1] = Number(
            (durations[durations.length - 1]! + tail).toFixed(3),
          );
        } else durations.push(tail);
        return durations;
      }
    }
  }

  // ---- no music: styled pacing curve -------------------------------------
  const n = Math.max(3, Math.round(total / base));
  const raw: number[] = [];
  for (let i = 0; i < n; i++) raw.push(target(i, n) * (0.85 + rand() * 0.3));
  raw[n - 1] = (raw[n - 1] ?? base) * recipe.endingHold;
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((d) => Number(((d / sum) * total).toFixed(3)));
}


/* ------------------------------------------------------------- building */

const PURPOSE_BY_TYPE: Record<ShotType, Purpose> = {
  hero: "hero",
  product: "product",
  detail: "detail",
  lifestyle: "lifestyle",
  action: "hero",
  environment: "lifestyle",
  transition: "detail",
  other: "detail",
};

const IN_ANIMATIONS: Animation[] = ["slow_push_in", "push_in", "punch_in", "drift", "pan_left"];
const LAYOUT_POOL = ["split-left", "split-right", "band", "inset", "diag-left", "strip-2"] as const;

function overlaysFor(recipe: EditRecipe, level: MakeSettings["effects"], total: number, rand: () => number): Overlay[] {
  if (level === "none") return [];
  const density = level === "light" ? 0.35 : 0.8;
  const out: Overlay[] = [];
  // continuous texture overlays run the whole edit
  const textures = recipe.overlays.filter((o) =>
    ["grain", "vignette", "film_border", "paper", "noise", "camcorder", "halation", "bloom"].includes(o),
  );
  const hits = recipe.overlays.filter((o) => !textures.includes(o));
  const keepTextures = level === "light" ? textures.slice(0, 1) : textures.slice(0, 3);
  for (const t of keepTextures) out.push({ type: t, start: 0, duration: total });
  const hitCount = Math.round(total * density * 0.25);
  for (let i = 0; i < hitCount && hits.length; i++) {
    const type = hits[Math.floor(rand() * hits.length)]!;
    out.push({
      type,
      start: Number((rand() * Math.max(0.1, total - 0.5)).toFixed(2)),
      duration: 0.25,
      accent: true,
    });
  }
  return out;
}

export interface BuildResult {
  spec: TemplateSpec;
  plan: Record<string, string>;
  offsets: Record<string, number>;
}

export function buildEdit(
  clips: Clip[],
  settings: MakeSettings,
  beatMap: BeatMap | null,
  seed: number,
  name: string,
): BuildResult {
  const recipe = recipeByKey(settings.styleKey);
  const style = simpleStyleFor(recipe);
  const rand = rng(seed);
  const fmt = FORMATS.find((f) => f.key === settings.format) ?? FORMATS[0]!;
  const durations = planCuts(recipe, settings.duration, beatMap, rand);

  const pool = clips.filter((c) => !c.rejected);
  const used: Record<string, number> = {};
  const slots: MediaSlot[] = [];
  const plan: Record<string, string> = {};
  const offsets: Record<string, number> = {};

  // every version rotates the shot-type sequence so openings differ
  const rotate = Math.floor(rand() * recipe.sequence.length);

  let t = 0;
  let prevClip: Clip | null = null;
  durations.forEach((duration, i) => {
    const wantType = recipe.sequence[(i + rotate) % recipe.sequence.length] ?? null;
    const ctx: ScoreContext = {
      need: duration,
      wantType,
      used,
      previousClipId: prevClip?.id,
      previousSourceId: prevClip?.sourceId,
    };
    const clip = weightedPick(pool, ctx, rand) ?? pool[i % Math.max(1, pool.length)] ?? null;
    const id = `shot-${i + 1}`;
    const layout =
      i > 0 && i < durations.length - 1 && rand() < recipe.layoutChance
        ? LAYOUT_POOL[Math.floor(rand() * LAYOUT_POOL.length)]!
        : "full";

    slots.push({
      id,
      label: `Shot ${i + 1}`,
      start: Number(t.toFixed(3)),
      duration: Number(duration.toFixed(3)),
      purpose: clip?.shotType ? PURPOSE_BY_TYPE[clip.shotType] : wantType ? PURPOSE_BY_TYPE[wantType] : "detail",
      layout,
      animationIn: rand() < 0.55 ? IN_ANIMATIONS[Math.floor(rand() * IN_ANIMATIONS.length)]! : "none",
      transitionOut:
        (recipe.transitions[Math.floor(rand() * recipe.transitions.length)] as Transition) ?? "hard_cut",
    });

    if (clip) {
      used[clip.id] = (used[clip.id] ?? 0) + 1;
      plan[id] = clip.id;
      offsets[id] = pickOffset(clip, duration, rand);
      prevClip = clip;
    }
    t += duration;
  });

  const total = Number(t.toFixed(3));
  const spec: TemplateSpec = {
    id: `edit-${seed.toString(36)}-${Date.now().toString(36)}`,
    name,
    duration: total,
    fps: 30,
    width: fmt.width,
    height: fmt.height,
    tags: [recipe.key, settings.format],
    palette: { bg: "#0a0a0a", ink: "#f5f5f0", accent: "#e7e2d6" },
    mediaSlots: slots,
    textSlots: [],
    overlays: overlaysFor(recipe, settings.effects, total, rand),
    beatMarkers: beatTimes(beatMap).filter((b) => b < total),
    creativeProfile: {
      family: recipe.name,
      energy: style.energy,
      pacing: style.pacing,
      typography: style.typography,
      transitionStyle: style.transitionIntensity,
      structure: recipe.sequence.join(" → "),
    },
    fontKey: style.stylePackKey,
  };

  return { spec, plan, offsets };
}

export function pickOffset(clip: Clip, need: number, rand: () => number) {
  const usable = clipLength(clip);
  const slack = Math.max(0, usable - need);
  return Number((clip.in + slack * (0.15 + rand() * 0.6)).toFixed(3));
}

/** Generate N genuinely different versions from the same selects. */
export function buildVersions(
  clips: Clip[],
  settings: MakeSettings,
  beatMap: BeatMap | null,
): EditVersion[] {
  const stamp = Date.now();
  return Array.from({ length: settings.count }, (_, i) => {
    const seed = stamp + i * 7919;
    const { spec, plan, offsets } = buildEdit(
      clips,
      settings,
      beatMap,
      seed,
      `Version ${i + 1}`,
    );
    return {
      id: `v-${stamp.toString(36)}-${i}`,
      name: `Version ${i + 1}`,
      createdAt: stamp,
      favorite: false,
      spec,
      plan,
      offsets,
      settings,
    } satisfies EditVersion;
  });
}

/* ---------------------------------------------------------- media mapping */

export function mediaMapFor(version: EditVersion, clips: Clip[]): MediaMap {
  const byId = new Map(clips.map((c) => [c.id, c]));
  const map: MediaMap = {};
  for (const slot of version.spec.mediaSlots) {
    const clip = byId.get(version.plan[slot.id] ?? "");
    if (!clip) continue;
    const url = cachedUrl(clip.sourceId);
    if (!url) continue;
    map[slot.id] = {
      url,
      kind: "video",
      name: clip.name,
      inPoint: version.offsets?.[slot.id] ?? clip.in,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      muted: true,
    };
  }
  return map;
}

/** Replace one shot with a specific clip. */
export function swapShot(version: EditVersion, slotId: string, clip: Clip): EditVersion {
  const slot = version.spec.mediaSlots.find((s) => s.id === slotId);
  const need = slot?.duration ?? 1;
  return {
    ...version,
    plan: { ...version.plan, [slotId]: clip.id },
    offsets: { ...(version.offsets ?? {}), [slotId]: pickOffset(clip, need, rng(Date.now() % 99991)) },
  };
}

/** Pick a fresh appropriate clip for one shot. */
export function shuffleShot(version: EditVersion, slotId: string, clips: Clip[]): EditVersion {
  const slot = version.spec.mediaSlots.find((s) => s.id === slotId);
  if (!slot) return version;
  const used: Record<string, number> = {};
  Object.entries(version.plan).forEach(([k, v]) => {
    if (k !== slotId) used[v] = (used[v] ?? 0) + 1;
  });
  const current = version.plan[slotId];
  const rand = rng(Date.now() % 99991);
  const ctx: ScoreContext = {
    need: slot.duration,
    wantType: null,
    used,
    previousClipId: current,
  };
  const pick = weightedPick(
    clips.filter((c) => !c.rejected && c.id !== current),
    ctx,
    rand,
  );
  return pick ? swapShot(version, slotId, pick) : version;
}

/** Re-pick every shot in a time range, leaving the rest of the edit intact. */
export function shuffleSection(
  version: EditVersion,
  slotIds: string[],
  clips: Clip[],
): EditVersion {
  let next = version;
  for (const id of slotIds) next = shuffleShot(next, id, clips);
  return next;
}

/** Remove a shot and re-lay the timeline so there are no gaps. */
export function deleteShot(version: EditVersion, slotId: string): EditVersion {
  const slots = version.spec.mediaSlots.filter((s) => s.id !== slotId);
  if (!slots.length) return version;
  return relayoutVersion({ ...version, spec: { ...version.spec, mediaSlots: slots } });
}

export function trimShot(version: EditVersion, slotId: string, duration: number): EditVersion {
  const slots = version.spec.mediaSlots.map((s) =>
    s.id === slotId ? { ...s, duration: Math.max(0.25, Number(duration.toFixed(2))) } : s,
  );
  return relayoutVersion({ ...version, spec: { ...version.spec, mediaSlots: slots } });
}

export function reorderShots(version: EditVersion, from: number, to: number): EditVersion {
  const slots = [...version.spec.mediaSlots].sort((a, b) => a.start - b.start);
  if (from === to || to < 0 || to >= slots.length) return version;
  const [item] = slots.splice(from, 1);
  slots.splice(to, 0, item!);
  return relayoutVersion({ ...version, spec: { ...version.spec, mediaSlots: slots } });
}

export function relayoutVersion(version: EditVersion): EditVersion {
  let t = 0;
  const slots = version.spec.mediaSlots.map((s) => {
    const out = { ...s, start: Number(t.toFixed(3)) };
    t += s.duration;
    return out;
  });
  return {
    ...version,
    spec: { ...version.spec, mediaSlots: slots, duration: Number(t.toFixed(3)) },
  };
}
