/**
 * SMART EXACT-COPY FITTING
 *
 * The client's exact words are never rewritten. When copy doesn't fit the
 * frame at a Type System's default size, this module finds a way to make it
 * fit: shrinking within the system's approved size range, breaking lines at
 * natural word boundaries, widening the safe area, nudging position, or
 * falling back to another approved system for the same role — in that order.
 */
import type { TemplateSpec, TextSlot } from "@/lib/template/types";
import { bestTypeSystemForRole, inferSlotRole, type TypeSystem } from "./typesystems";

export interface FitAdjustment {
  slotId: string;
  kind: "shrink" | "line_break" | "widen" | "reposition" | "fallback_system";
  detail: string;
}

/** Rough average glyph width as a fraction of font size, for a bold display face. */
const AVG_CHAR_WIDTH_FACTOR = 0.58;
const BASE_FONT_PX = 120;

function estimateLineWidthPx(text: string, sizeScale: number): number {
  return text.length * AVG_CHAR_WIDTH_FACTOR * BASE_FONT_PX * sizeScale;
}

function availableWidthPx(spec: TemplateSpec, maxWidthPct: number): number {
  return (spec.width * maxWidthPct) / 100;
}

/** Break text into balanced lines (roughly equal line lengths) without changing the words. */
function balancedLineBreak(text: string, targetLines: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= 1 || targetLines <= 1) return text;
  const perLine = Math.ceil(words.length / targetLines);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += perLine) {
    lines.push(words.slice(i, i + perLine).join(" "));
  }
  return lines.join("\n");
}

function longestLineLength(text: string): number {
  return Math.max(...text.split("\n").map((l) => l.length));
}

/**
 * Fit a single slot's exact text against a Type System's constraints without
 * ever rewriting the copy — only sizing, breaking, widening and repositioning.
 */
export function fitText(
  slot: TextSlot,
  system: TypeSystem,
  spec: TemplateSpec,
): { slot: TextSlot; adjustments: FitAdjustment[] } {
  const adjustments: FitAdjustment[] = [];
  let sizeScale = slot.sizeScale ?? system.sizeScale;
  let maxWidthPct = system.maxWidthPct;
  let value = slot.value;
  let position = slot.position;

  const fits = (text: string, scale: number, widthPct: number) =>
    estimateLineWidthPx(longestLineLength(text) > 0 ? text.split("\n").reduce((a, b) => (a.length > b.length ? a : b)) : "", scale) <=
    availableWidthPx(spec, widthPct);

  if (!fits(value, sizeScale, maxWidthPct)) {
    // 1. shrink within the approved range
    const step = 0.05;
    let candidate = sizeScale;
    while (candidate - step >= system.minSizeScale && !fits(value, candidate, maxWidthPct)) {
      candidate -= step;
    }
    if (candidate !== sizeScale) {
      sizeScale = Math.max(system.minSizeScale, candidate);
      adjustments.push({ slotId: slot.id, kind: "shrink", detail: `sizeScale -> ${sizeScale.toFixed(2)}` });
    }
  }

  if (!fits(value, sizeScale, maxWidthPct)) {
    // 2. insert balanced line breaks
    const words = value.trim().split(/\s+/).length;
    const maxLines = Math.min(4, Math.max(2, words));
    for (let lines = 2; lines <= maxLines; lines++) {
      const broken = balancedLineBreak(value, lines);
      if (fits(broken, sizeScale, maxWidthPct)) {
        value = broken;
        adjustments.push({ slotId: slot.id, kind: "line_break", detail: `${lines} lines` });
        break;
      }
    }
  }

  if (!fits(value, sizeScale, maxWidthPct)) {
    // 3. widen the safe area
    const widened = Math.min(96, maxWidthPct + 12);
    if (widened !== maxWidthPct) {
      maxWidthPct = widened;
      adjustments.push({ slotId: slot.id, kind: "widen", detail: `maxWidthPct -> ${maxWidthPct}` });
    }
  }

  if (!fits(value, sizeScale, maxWidthPct) && position !== "center") {
    // 4. nudge vertical position to buy more room
    position = "center";
    adjustments.push({ slotId: slot.id, kind: "reposition", detail: "position -> center" });
  }

  return {
    slot: { ...slot, value, sizeScale, position },
    adjustments,
  };
}

/** Fit every text slot in a spec against the best (and, if needed, fallback) approved systems. */
export function fitSpecText(
  spec: TemplateSpec,
  systems: TypeSystem[],
): { spec: TemplateSpec; adjustments: FitAdjustment[] } {
  const allAdjustments: FitAdjustment[] = [];
  const textSlots = spec.textSlots.map((slot) => {
    const role = inferSlotRole(slot);
    const candidates = systems.filter((s) => s.role === role);
    const primary = bestTypeSystemForRole(systems, role);
    if (!primary) return slot;

    let best = fitText(slot, primary, spec);
    if (best.adjustments.some((a) => a.kind === "reposition")) {
      // 5. try a fallback system of the same role before giving up
      const fallback = candidates.find((s) => s.id !== primary.id);
      if (fallback) {
        const alt = fitText(slot, fallback, spec);
        if (alt.adjustments.length < best.adjustments.length) {
          best = alt;
          allAdjustments.push({ slotId: slot.id, kind: "fallback_system", detail: fallback.name });
        }
      }
    }
    allAdjustments.push(...best.adjustments);
    return best.slot;
  });
  return { spec: { ...spec, textSlots }, adjustments: allAdjustments };
}
