/**
 * HARVEST CREATIVE PARTS
 *
 * A persistent library of reusable structural fragments cut out of specs —
 * openers, endings, text moments, transitions, product reveals, graphic
 * moments, microcut sequences, whole "recipes" (hero sequences / interludes).
 * `extractRegion` time-normalises a [start,end) window into a fragment;
 * `applyPart` splices it back into a target spec at a chosen time.
 */
import { useSyncExternalStore } from "react";
import type {
  CreativeEvent,
  GraphicSlot,
  MediaSlot,
  MotionAssetEvent,
  Overlay,
  TemplateSpec,
  TextSlot,
} from "@/lib/template/types";

export type PartKind =
  | "opener"
  | "ending"
  | "text_moment"
  | "transition"
  | "product_reveal"
  | "interlude"
  | "hero_sequence"
  | "graphic_moment"
  | "microcut_sequence"
  | "recipe";

export interface PartFragment {
  mediaSlots: MediaSlot[];
  textSlots: TextSlot[];
  graphicSlots: GraphicSlot[];
  creativeEvents: CreativeEvent[];
  motionAssets: MotionAssetEvent[];
  overlays: Overlay[];
  /** fragment duration, i.e. end - start of the harvested region */
  duration: number;
}

export interface SavedPart {
  id: string;
  name: string;
  kind: PartKind;
  sourceSpecId: string;
  range: [number, number];
  fragment: PartFragment;
  tags: string[];
  createdAt: number;
  uses: number;
}

const KEY = "tempo.creative.parts.v1";
const EMPTY: SavedPart[] = [];
let parts: SavedPart[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) parts = JSON.parse(raw) as SavedPart[];
  } catch {
    /* ignore */
  }
}

function commit(next: SavedPart[]) {
  parts = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(parts));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function useParts() {
  hydrate();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => parts,
    () => EMPTY,
  );
}

export function allParts(): SavedPart[] {
  hydrate();
  return parts;
}

function within(start: number, dur: number, from: number, to: number) {
  const a = start;
  const b = start + dur;
  return a < to && b > from;
}

function clip(start: number, dur: number, from: number, to: number) {
  const a = Math.max(start, from);
  const b = Math.min(start + dur, to);
  return { start: a - from, duration: Math.max(0.05, b - a) };
}

/** Extracts and time-normalises everything that overlaps [start,end) to t=0. */
export function extractRegion(spec: TemplateSpec, start: number, end: number): PartFragment {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.max(from + 0.01, Math.max(start, end));

  const mediaSlots: MediaSlot[] = spec.mediaSlots
    .filter((s) => within(s.start, s.duration, from, to))
    .map((s) => {
      const { start: ns, duration: nd } = clip(s.start, s.duration, from, to);
      return { ...s, id: `${s.id}`, start: Number(ns.toFixed(3)), duration: Number(nd.toFixed(3)) };
    });

  const textSlots: TextSlot[] = spec.textSlots
    .filter((t) => within(t.start, t.duration, from, to))
    .map((t) => {
      const { start: ns, duration: nd } = clip(t.start, t.duration, from, to);
      return { ...t, start: Number(ns.toFixed(3)), duration: Number(nd.toFixed(3)) };
    });

  const graphicSlots: GraphicSlot[] = (spec.graphicSlots ?? [])
    .filter((g) => within(g.start, g.duration, from, to))
    .map((g) => {
      const { start: ns, duration: nd } = clip(g.start, g.duration, from, to);
      return { ...g, start: Number(ns.toFixed(3)), duration: Number(nd.toFixed(3)) };
    });

  const creativeEvents: CreativeEvent[] = (spec.creativeEvents ?? [])
    .filter((e) => within(e.start, e.duration, from, to))
    .map((e) => {
      const { start: ns, duration: nd } = clip(e.start, e.duration, from, to);
      return { ...e, start: Number(ns.toFixed(3)), duration: Number(nd.toFixed(3)) };
    });

  const motionAssets: MotionAssetEvent[] = (spec.motionAssets ?? [])
    .filter((m) => within(m.start, m.duration, from, to))
    .map((m) => {
      const { start: ns, duration: nd } = clip(m.start, m.duration, from, to);
      return { ...m, start: Number(ns.toFixed(3)), duration: Number(nd.toFixed(3)) };
    });

  const overlays: Overlay[] = (spec.overlays ?? [])
    .filter((o) => within(o.start, o.duration, from, to))
    .map((o) => {
      const { start: ns, duration: nd } = clip(o.start, o.duration, from, to);
      return { ...o, start: Number(ns.toFixed(3)), duration: Number(nd.toFixed(3)) };
    });

  return {
    mediaSlots,
    textSlots,
    graphicSlots,
    creativeEvents,
    motionAssets,
    overlays,
    duration: Number((to - from).toFixed(3)),
  };
}

export function savePart(input: Omit<SavedPart, "id" | "createdAt" | "uses">): SavedPart {
  hydrate();
  const part: SavedPart = {
    ...input,
    id: `part-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    createdAt: Date.now(),
    uses: 0,
  };
  commit([part, ...parts]);
  return part;
}

export function deletePart(id: string) {
  hydrate();
  commit(parts.filter((p) => p.id !== id));
}

export function recordPartUse(id: string) {
  hydrate();
  commit(parts.map((p) => (p.id === id ? { ...p, uses: p.uses + 1 } : p)));
}

let uid = 0;
function reid(prefix: string) {
  uid += 1;
  return `${prefix}-${Date.now().toString(36)}-${uid}`;
}

/** Splices a saved fragment back into a spec, retimed to `atSeconds`, with fresh ids. */
export function applyPart(spec: TemplateSpec, part: SavedPart, atSeconds: number): TemplateSpec {
  const f = part.fragment;
  const at = Math.max(0, Math.min(atSeconds, Math.max(0, spec.duration - f.duration)));

  const mediaSlots: MediaSlot[] = f.mediaSlots.map((s) => ({
    ...s,
    id: reid("media"),
    start: Number((s.start + at).toFixed(3)),
  }));
  const textSlots: TextSlot[] = f.textSlots.map((t) => ({
    ...t,
    id: reid("text"),
    start: Number((t.start + at).toFixed(3)),
  }));
  const graphicSlots: GraphicSlot[] = f.graphicSlots.map((g) => ({
    ...g,
    id: reid("graphic"),
    start: Number((g.start + at).toFixed(3)),
  }));
  const creativeEvents: CreativeEvent[] = f.creativeEvents.map((e) => ({
    ...e,
    id: reid("ce"),
    start: Number((e.start + at).toFixed(3)),
  }));
  const motionAssets: MotionAssetEvent[] = f.motionAssets.map((m) => ({
    ...m,
    id: reid("motion"),
    start: Number((m.start + at).toFixed(3)),
  }));
  const overlays: Overlay[] = f.overlays.map((o) => ({
    ...o,
    start: Number((o.start + at).toFixed(3)),
  }));

  const clear = (from: number, to: number) => {
    const outside = (start: number, dur: number) => !within(start, dur, from, to);
    return {
      mediaSlots: spec.mediaSlots.filter((s) => outside(s.start, s.duration)),
      textSlots: spec.textSlots.filter((t) => outside(t.start, t.duration)),
      graphicSlots: (spec.graphicSlots ?? []).filter((g) => outside(g.start, g.duration)),
      creativeEvents: (spec.creativeEvents ?? []).filter((e) => outside(e.start, e.duration)),
      motionAssets: (spec.motionAssets ?? []).filter((m) => outside(m.start, m.duration)),
      overlays: (spec.overlays ?? []).filter((o) => outside(o.start, o.duration)),
    };
  };
  const base = clear(at, at + f.duration);

  return {
    ...spec,
    mediaSlots: [...base.mediaSlots, ...mediaSlots].sort((a, b) => a.start - b.start),
    textSlots: [...base.textSlots, ...textSlots].sort((a, b) => a.start - b.start),
    graphicSlots: [...base.graphicSlots, ...graphicSlots].sort((a, b) => a.start - b.start),
    creativeEvents: [...base.creativeEvents, ...creativeEvents].sort((a, b) => a.start - b.start),
    motionAssets: [...base.motionAssets, ...motionAssets].sort((a, b) => a.start - b.start),
    overlays: [...base.overlays, ...overlays].sort((a, b) => a.start - b.start),
    tags: [...new Set([...(spec.tags ?? []), `part:${part.kind}`])],
  };
}
