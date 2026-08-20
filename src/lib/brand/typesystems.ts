/**
 * TYPE SYSTEMS
 *
 * A Type System is an approved, reusable text treatment for a given semantic
 * role (hero / feature / label / cta / stat / caption). Rather than letting
 * every generated template invent its own type, the generator maps each
 * TextSlot onto the best-fit approved system for its role and writes that
 * system's visual + motion properties onto the slot.
 */
import { useSyncExternalStore } from "react";
import type { TextSlot, TextStyleName, TemplateSpec } from "@/lib/template/types";
import type { BrandKit } from "./store";

export type TypeSystemRole = "hero" | "feature" | "label" | "cta" | "stat" | "caption";

export const TYPE_SYSTEM_ROLES: TypeSystemRole[] = [
  "hero",
  "feature",
  "label",
  "cta",
  "stat",
  "caption",
];

export type TypeSystemBackground = "none" | "bar" | "block" | "blur";

export interface TypeSystem {
  id: string;
  brandId: string;
  name: string;
  role: TypeSystemRole;
  fontId?: string | undefined;
  fontWeight: number;
  sizeScale: number;
  minSizeScale: number;
  maxSizeScale: number;
  uppercase: boolean;
  tracking: number;
  lineHeight: number;
  align: "left" | "center" | "right";
  maxWidthPct: number;
  color?: string | undefined;
  stroke: number;
  strokeColor?: string | undefined;
  background: TypeSystemBackground;
  animation: TextStyleName;
  position: "top" | "center" | "bottom";
  createdAt: number;
}

interface TypeSystemState {
  systems: TypeSystem[];
}

const KEY = "tempo.brand.typesystems.v1";
const empty: TypeSystemState = { systems: [] };
let state: TypeSystemState = empty;
let hydrated = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...empty, ...(JSON.parse(raw) as TypeSystemState) };
  } catch {
    /* ignore */
  }
}

function commit(next: TypeSystemState) {
  state = next;
  persist();
  notify();
}

export function useTypeSystems() {
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

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`;

export function typeSystemsForBrand(brandId: string): TypeSystem[] {
  hydrate();
  return state.systems.filter((s) => s.brandId === brandId);
}

export function saveTypeSystem(system: Omit<TypeSystem, "id" | "createdAt"> & { id?: string }): TypeSystem {
  hydrate();
  const id = system.id ?? uid("type");
  const existing = state.systems.find((s) => s.id === id);
  const next: TypeSystem = { ...system, id, createdAt: existing?.createdAt ?? Date.now() };
  commit({ systems: [next, ...state.systems.filter((s) => s.id !== id)] });
  return next;
}

export function deleteTypeSystem(id: string) {
  hydrate();
  commit({ systems: state.systems.filter((s) => s.id !== id) });
}

function baseSystem(brandId: string, role: TypeSystemRole): Omit<TypeSystem, "id" | "createdAt"> {
  switch (role) {
    case "hero":
      return {
        brandId,
        name: "Hero",
        role,
        fontWeight: 800,
        sizeScale: 1.35,
        minSizeScale: 0.85,
        maxSizeScale: 1.6,
        uppercase: true,
        tracking: -2,
        lineHeight: 0.98,
        align: "center",
        maxWidthPct: 86,
        stroke: 0,
        background: "none",
        animation: "oversized_hook",
        position: "center",
      };
    case "feature":
      return {
        brandId,
        name: "Feature",
        role,
        fontWeight: 700,
        sizeScale: 1,
        minSizeScale: 0.7,
        maxSizeScale: 1.2,
        uppercase: false,
        tracking: -1,
        lineHeight: 1.08,
        align: "left",
        maxWidthPct: 78,
        stroke: 0,
        background: "none",
        animation: "feature_callout",
        position: "bottom",
      };
    case "label":
      return {
        brandId,
        name: "Label",
        role,
        fontWeight: 600,
        sizeScale: 0.55,
        minSizeScale: 0.4,
        maxSizeScale: 0.7,
        uppercase: true,
        tracking: 2,
        lineHeight: 1.1,
        align: "left",
        maxWidthPct: 60,
        stroke: 0,
        background: "bar",
        animation: "minimal_caption",
        position: "top",
      };
    case "cta":
      return {
        brandId,
        name: "CTA",
        role,
        fontWeight: 800,
        sizeScale: 0.85,
        minSizeScale: 0.6,
        maxSizeScale: 1,
        uppercase: true,
        tracking: 0,
        lineHeight: 1,
        align: "center",
        maxWidthPct: 70,
        stroke: 0,
        background: "block",
        animation: "cta_lockup",
        position: "bottom",
      };
    case "stat":
      return {
        brandId,
        name: "Stat",
        role,
        fontWeight: 800,
        sizeScale: 1.15,
        minSizeScale: 0.8,
        maxSizeScale: 1.4,
        uppercase: false,
        tracking: -1,
        lineHeight: 1,
        align: "center",
        maxWidthPct: 70,
        stroke: 0,
        background: "none",
        animation: "stat_callout",
        position: "center",
      };
    case "caption":
    default:
      return {
        brandId,
        name: "Caption",
        role,
        fontWeight: 500,
        sizeScale: 0.45,
        minSizeScale: 0.32,
        maxSizeScale: 0.6,
        uppercase: false,
        tracking: 0,
        lineHeight: 1.2,
        align: "center",
        maxWidthPct: 80,
        stroke: 0,
        background: "blur",
        animation: "subtitle",
        position: "bottom",
      };
  }
}

export function DEFAULT_TYPE_SYSTEMS(brandId: string): Omit<TypeSystem, "id" | "createdAt">[] {
  return TYPE_SYSTEM_ROLES.map((role) => baseSystem(brandId, role));
}

/** Seed one default, approved Type System per role for a brand (idempotent). */
export function seedTypeSystemsForBrand(brandId: string, kit?: BrandKit | null): TypeSystem[] {
  hydrate();
  const existing = typeSystemsForBrand(brandId);
  const missingRoles = TYPE_SYSTEM_ROLES.filter((role) => !existing.some((s) => s.role === role));
  if (!missingRoles.length) return existing;
  const displayFont = kit?.fonts.find((f) => f.role === "display");
  const bodyFont = kit?.fonts.find((f) => f.role === "body") ?? kit?.fonts.find((f) => f.role === "secondary");
  const accentFont = kit?.fonts.find((f) => f.role === "accent") ?? displayFont;
  const seeded = missingRoles.map((role) => {
    const base = baseSystem(brandId, role);
    const fontId =
      role === "cta" ? accentFont?.id : role === "label" || role === "caption" ? bodyFont?.id : displayFont?.id;
    const color = role === "cta" ? kit?.colors.accent : kit?.colors.ink;
    return { ...base, ...(fontId ? { fontId } : {}), ...(color ? { color } : {}) };
  });
  const next = { systems: [...state.systems, ...seeded.map((s) => ({ ...s, id: uid("type"), createdAt: Date.now() }))] };
  commit(next);
  return typeSystemsForBrand(brandId);
}

/** Infer the semantic role of a text slot from its label / style. */
export function inferSlotRole(slot: TextSlot): TypeSystemRole {
  const label = slot.label.toUpperCase();
  if (label.includes("CTA") || slot.style === "cta_lockup") return "cta";
  if (label.includes("STAT") || slot.style === "stat_callout") return "stat";
  if (label.includes("HOOK") || slot.style === "oversized_hook" || slot.style === "giant_word") return "hero";
  if (label.includes("FEATURE") || slot.style === "feature_callout") return "feature";
  if (
    label.includes("LABEL") ||
    label.includes("OFFER") ||
    slot.style === "highlight_bar" ||
    slot.style === "edge_aligned"
  )
    return "label";
  if (slot.style === "subtitle" || slot.style === "minimal_caption" || slot.style === "ticker") return "caption";
  return "feature";
}

/** Pick the best approved Type System for a given role. */
export function bestTypeSystemForRole(systems: TypeSystem[], role: TypeSystemRole): TypeSystem | undefined {
  return systems.find((s) => s.role === role) ?? systems[0];
}

function applySystemToSlot(slot: TextSlot, system: TypeSystem): TextSlot {
  return {
    ...slot,
    ...(system.fontId ?? slot.fontKey ? { fontKey: (system.fontId ?? slot.fontKey) as string } : {}),
    fontWeight: system.fontWeight,
    sizeScale: system.sizeScale,
    tracking: system.tracking,
    lineHeight: system.lineHeight,
    align: system.align,
    ...(system.color ?? slot.color ? { color: (system.color ?? slot.color) as string } : {}),
    stroke: system.stroke,
    ...(system.strokeColor ?? slot.strokeColor ? { strokeColor: (system.strokeColor ?? slot.strokeColor) as string } : {}),
    ...(system.background === "none" ? {} : { background: system.background }),
    style: system.animation,
    position: system.position,
  };
}

/** Map every TextSlot in a spec onto the best approved Type System for its role. */
export function applyTypeSystems(spec: TemplateSpec, systems: TypeSystem[]): TemplateSpec {
  if (!systems.length) return spec;
  const used = new Set<string>();
  const textSlots = spec.textSlots.map((slot) => {
    const role = inferSlotRole(slot);
    const system = bestTypeSystemForRole(systems, role);
    if (!system) return slot;
    used.add(system.id);
    return applySystemToSlot(slot, system);
  });
  return { ...spec, textSlots, typeSystemIds: [...new Set([...(spec.typeSystemIds ?? []), ...used])] };
}
