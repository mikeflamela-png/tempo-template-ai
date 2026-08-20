/**
 * SWAP MOTION
 *
 * Lists every motion treatment on a spec — creative kernel events, imported
 * motion-asset events, and unfilled/filled blueprint motion slots — and lets
 * the user audition visual alternatives for the one they pick, each as a real
 * live TemplatePlayer preview of the whole spec with just that moment swapped.
 */
import { useMemo, useState } from "react";
import { TemplatePlayer } from "@/components/video/TemplatePlayer";
import type { AudioTrack, CreativeEvent, MediaMap, MotionAssetEvent, TemplateSpec } from "@/lib/template/types";
import { KERNELS, type KernelDef } from "@/lib/creative/kernels";
import { blueprintById, resolveMotionSlots, type MotionSlot } from "@/lib/blueprint/library";
import { pickAssetsForSlot, useMotionAssets, type MotionAsset } from "@/lib/motion/assets";

export interface SwapMotionProps {
  spec: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
  audio?: AudioTrack | null | undefined;
  onApply: (next: TemplateSpec) => void;
}

type TreatmentKind = "creative_event" | "motion_asset" | "blueprint_slot";

interface Treatment {
  kind: TreatmentKind;
  id: string;
  label: string;
  at: number;
  slotKey?: string;
}

type Alternative =
  | { kind: "kernel"; kernel: KernelDef; label: string }
  | { kind: "asset"; asset: MotionAsset; label: string }
  | { kind: "none"; label: string };

const ALT_MIN = 4;
const ALT_MAX = 8;

function collectTreatments(spec: TemplateSpec): Treatment[] {
  const out: Treatment[] = [];
  for (const e of spec.creativeEvents ?? []) {
    out.push({ kind: "creative_event", id: e.id, label: e.label || kernelLabel(e.kernel), at: e.start });
  }
  for (const m of spec.motionAssets ?? []) {
    out.push({ kind: "motion_asset", id: m.id, label: m.label || "Motion asset", at: m.start, slotKey: m.slotKey });
  }
  const blueprint = blueprintById(spec.blueprintId);
  if (blueprint) {
    const filledSlotKeys = new Set([
      ...(spec.motionAssets ?? []).map((m) => m.slotKey).filter(Boolean),
      ...Object.keys(spec.motionSlotPlan ?? {}),
    ]);
    for (const slot of resolveMotionSlots(blueprint, spec.duration)) {
      if (filledSlotKeys.has(slot.key)) continue;
      out.push({ kind: "blueprint_slot", id: slot.key, label: slot.name, at: slot.start, slotKey: slot.key });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

function kernelLabel(id: string): string {
  return KERNELS.find((k) => k.id === id)?.name ?? id;
}

/** Human names for a few well-known kernel/asset combos, per the spec's examples. */
const NICE_NAMES: Record<string, string> = {
  paper_rip: "Paper Tear",
  film_burn: "Exposure Flash",
  film_strip_rush: "Film Strip",
  shutter_sequence: "Shutter Flash",
  contact_sheet: "Contact Sheet",
  photo_stack: "Photo Stack",
  scribble_impact: "Handwritten Interruption",
  light_leak: "Light Leak Reveal",
  frame_echo: "Frame Echo",
  type_crash: "Type Crash",
  word_push: "Word Push",
  marker_circle: "Marker Callout",
  magnifier: "Product Magnifier",
  crop_marks: "Editorial Crop Marks",
  texture_wash: "Texture Wash",
  freeze_annotation: "Freeze & Annotate",
};

function niceKernelName(k: KernelDef): string {
  return NICE_NAMES[k.id] ?? k.name;
}

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Draws alternatives from creative kernels + the current motion kit's imported assets. */
function buildAlternatives(treatment: Treatment, spec: TemplateSpec, seed: number): Alternative[] {
  const rng = seeded(seed);
  const isTransitionish = treatment.kind !== "blueprint_slot" ? undefined : undefined;
  void isTransitionish;

  const kernelPool: KernelDef[] = KERNELS.filter((k) => {
    if (treatment.kind === "creative_event") return true;
    if (treatment.kind === "motion_asset") return k.role === "event" || k.role === "treatment";
    return true;
  });

  const assetPool = pickAssetsForSlot({ count: 24, rng: Math.random }).filter((a) => a.quality !== "retired");
  // favour core assets: sort core first, keep some specialty in the mix
  const sortedAssets = [...assetPool].sort((a, b) => {
    const w = (x: MotionAsset) => (x.quality === "core" ? 0 : x.quality === "specialty" ? 1 : 2);
    return w(a) - w(b);
  });

  const kernelAlts: Alternative[] = shuffle(kernelPool, rng).map((k) => ({
    kind: "kernel" as const,
    kernel: k,
    label: niceKernelName(k),
  }));
  const assetAlts: Alternative[] = sortedAssets.slice(0, 6).map((a) => ({
    kind: "asset" as const,
    asset: a,
    label: a.name,
  }));

  const cleanCut: Alternative[] = treatment.kind !== "blueprint_slot" ? [{ kind: "none", label: "Clean Hard Cut" }] : [];

  const merged = shuffle([...cleanCut, ...assetAlts, ...kernelAlts], seeded(seed + 7777));
  // dedupe by label, keep order
  const seen = new Set<string>();
  const deduped = merged.filter((m) => (seen.has(m.label) ? false : (seen.add(m.label), true)));
  const count = Math.max(ALT_MIN, Math.min(ALT_MAX, deduped.length));
  return deduped.slice(0, count);
}

/** Applies an alternative to the spec by swapping just that one treatment. */
function applyAlternative(spec: TemplateSpec, treatment: Treatment, alt: Alternative): TemplateSpec {
  const next: TemplateSpec = { ...spec };

  if (treatment.kind === "creative_event") {
    const events = [...(spec.creativeEvents ?? [])];
    const idx = events.findIndex((e) => e.id === treatment.id);
    if (idx === -1) return spec;
    const original = events[idx]!;
    if (alt.kind === "none") {
      events.splice(idx, 1);
      next.creativeEvents = events;
      return next;
    }
    if (alt.kind === "kernel") {
      const fresh: CreativeEvent = {
        ...original,
        kernel: alt.kernel.id,
        techniqueId: undefined,
        label: alt.kernel.name,
        duration: Math.min(original.duration, alt.kernel.defaultDuration * 1.6) || alt.kernel.defaultDuration,
        params: Object.fromEntries(alt.kernel.params.map((p) => [p.key, p.default])),
      };
      events[idx] = fresh;
      next.creativeEvents = events;
      return next;
    }
    if (alt.kind === "asset") {
      // move this moment onto a motion asset instead of a kernel event
      events.splice(idx, 1);
      next.creativeEvents = events;
      const assets = [...(spec.motionAssets ?? [])];
      assets.push({
        id: `${original.id}-swap-${alt.asset.id}`,
        assetId: alt.asset.id,
        label: alt.label,
        start: original.start,
        duration: original.duration || alt.asset.durationSec || 1,
        scale: alt.asset.defaultScale,
        x: alt.asset.defaultX,
        y: alt.asset.defaultY,
        opacity: alt.asset.defaultOpacity,
        blend: alt.asset.blend,
        loop: alt.asset.loop,
        reverse: alt.asset.reverse,
        speed: alt.asset.speed,
      });
      next.motionAssets = assets;
      return next;
    }
  }

  if (treatment.kind === "motion_asset") {
    const assets = [...(spec.motionAssets ?? [])];
    const idx = assets.findIndex((m) => m.id === treatment.id);
    if (idx === -1) return spec;
    const original = assets[idx]!;
    if (alt.kind === "none") {
      assets.splice(idx, 1);
      next.motionAssets = assets;
      return next;
    }
    if (alt.kind === "asset") {
      assets[idx] = {
        ...original,
        assetId: alt.asset.id,
        label: alt.label,
        scale: alt.asset.defaultScale,
        x: alt.asset.defaultX,
        y: alt.asset.defaultY,
        opacity: alt.asset.defaultOpacity,
        blend: alt.asset.blend,
        loop: alt.asset.loop,
        reverse: alt.asset.reverse,
        speed: alt.asset.speed,
      };
      next.motionAssets = assets;
      return next;
    }
    if (alt.kind === "kernel") {
      assets.splice(idx, 1);
      next.motionAssets = assets;
      const events = [...(spec.creativeEvents ?? [])];
      events.push({
        id: `${original.id}-swap-${alt.kernel.id}`,
        kernel: alt.kernel.id,
        label: alt.kernel.name,
        start: original.start,
        duration: Math.min(original.duration, alt.kernel.defaultDuration * 1.6) || alt.kernel.defaultDuration,
        params: Object.fromEntries(alt.kernel.params.map((p) => [p.key, p.default])),
      });
      next.creativeEvents = events;
      return next;
    }
  }

  if (treatment.kind === "blueprint_slot") {
    const plan = { ...(spec.motionSlotPlan ?? {}) };
    if (alt.kind === "none") {
      delete plan[treatment.id];
      next.motionSlotPlan = plan;
      return next;
    }
    if (alt.kind === "asset") {
      plan[treatment.id] = alt.asset.id;
      next.motionSlotPlan = plan;
      const assets = [...(spec.motionAssets ?? [])];
      assets.push({
        id: `slot-${treatment.id}-${alt.asset.id}`,
        assetId: alt.asset.id,
        slotKey: treatment.id,
        label: alt.label,
        start: treatment.at,
        duration: Math.max(0.4, Math.min(alt.asset.durationSec || 0.8, 1.6)),
        scale: alt.asset.defaultScale,
        x: alt.asset.defaultX,
        y: alt.asset.defaultY,
        opacity: alt.asset.defaultOpacity,
        blend: alt.asset.blend,
        loop: alt.asset.loop,
        reverse: alt.asset.reverse,
        speed: alt.asset.speed,
      });
      next.motionAssets = assets;
      return next;
    }
    if (alt.kind === "kernel") {
      plan[treatment.id] = alt.kernel.id;
      next.motionSlotPlan = plan;
      const events = [...(spec.creativeEvents ?? [])];
      events.push({
        id: `slot-${treatment.id}-${alt.kernel.id}`,
        kernel: alt.kernel.id,
        label: alt.kernel.name,
        start: treatment.at,
        duration: alt.kernel.defaultDuration,
        params: Object.fromEntries(alt.kernel.params.map((p) => [p.key, p.default])),
      });
      next.creativeEvents = events;
      return next;
    }
  }

  return spec;
}

export default function SwapMotion({ spec, media, textOverrides, audio, onApply }: SwapMotionProps) {
  useMotionAssets(); // subscribe so newly imported/kit'd assets show up live
  const treatments = useMemo(() => collectTreatments(spec), [spec]);
  const [selectedId, setSelectedId] = useState<string | null>(treatments[0]?.id ?? null);
  const [seed, setSeed] = useState(1);

  const selected = treatments.find((t) => t.id === selectedId) ?? null;
  const alternatives = useMemo(
    () => (selected ? buildAlternatives(selected, spec, seed) : []),
    [selected, spec, seed],
  );

  const previewFrame = (at: number) => Math.max(0, Math.round(at * spec.fps));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 text-sm text-foreground">
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Motion treatments</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {treatments.length === 0 && (
            <p className="text-xs text-muted-foreground">No motion treatments on this spec yet.</p>
          )}
          {treatments.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                t.id === selectedId
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground"
              }`}
              title={`${t.kind.replace("_", " ")} @ ${t.at.toFixed(2)}s`}
            >
              {t.label}
              <span className="ml-1 opacity-60">{t.at.toFixed(1)}s</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Alternatives for “{selected.label}”
            </h4>
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="rounded-md border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Try another
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {alternatives.map((alt, i) => {
              const nextSpec = applyAlternative(spec, selected, alt);
              return (
                <button
                  key={`${alt.label}-${i}`}
                  type="button"
                  onClick={() => onApply(nextSpec)}
                  className="group flex flex-col overflow-hidden rounded-lg border border-border/60 bg-muted/10 text-left transition-colors hover:border-primary"
                >
                  <div className="aspect-[9/16] w-full overflow-hidden bg-black">
                    <TemplatePlayer
                      spec={nextSpec}
                      media={media}
                      textOverrides={textOverrides}
                      audio={audio}
                      controls={false}
                      autoPlay={false}
                      clickToPlay={false}
                      loop
                      initialFrame={previewFrame(selected.at)}
                    />
                  </div>
                  <div className="truncate px-2 py-1.5 text-xs text-muted-foreground group-hover:text-foreground">
                    {alt.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
