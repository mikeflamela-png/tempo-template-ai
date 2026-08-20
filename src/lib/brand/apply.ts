/**
 * Applies a Brand Kit and a Copy Kit onto a generated TemplateSpec.
 *
 * Generation stays creative; this layer is the discipline pass: real brand
 * colors, real uploaded fonts by role, and — in Exact Copy mode — the client's
 * words verbatim, with any surplus text slots removed instead of invented.
 */
import type { TemplateSpec, TextSlot } from "@/lib/template/types";
import { roleFont, type BrandKit, type CopyKit } from "./store";

function copyLines(copy: CopyKit): { label: string; value: string }[] {
  const rows = [
    { label: "HOOK", value: copy.hook },
    { label: "HEADLINE", value: copy.headline },
    { label: "FEATURE", value: copy.feature },
    { label: "SUPPORT", value: copy.support },
    { label: "OFFER", value: copy.offer },
    ...copy.extras.map((value) => ({ label: "LINE", value })),
  ];
  return rows.filter((r) => r.value.trim().length > 0);
}

function shorten(value: string, max: number) {
  if (value.length <= max) return value;
  const words = value.split(/\s+/);
  const out: string[] = [];
  for (const w of words) {
    if ([...out, w].join(" ").length > max) break;
    out.push(w);
  }
  return (out.join(" ") || value.slice(0, max)).replace(/[,;:]$/, "");
}

export function applyBrand(
  spec: TemplateSpec,
  kit?: BrandKit | null,
  copy?: CopyKit | null,
): TemplateSpec {
  let next: TemplateSpec = { ...spec };

  if (kit) {
    next.palette = { bg: kit.colors.bg, ink: kit.colors.ink, accent: kit.colors.accent };
    const display = roleFont(kit, "display");
    const body = roleFont(kit, "body") ?? roleFont(kit, "secondary");
    const accent = roleFont(kit, "accent") ?? display;
    if (display) next.fontKey = display.id;
    next.textSlots = next.textSlots.map((t) => {
      const isSmall = t.style === "subtitle" || t.style === "minimal_caption" || t.style === "ticker";
      const isCta = t.style === "cta_lockup" || t.label === "CTA";
      const chosen = isCta ? accent : isSmall ? body : display;
      return chosen ? { ...t, fontKey: chosen.id } : t;
    });
    // brand tolerance for motion: trim creative events beyond the intensity
    const allowed = Math.max(1, Math.round((kit.animationIntensity / 10) * 8));
    if (next.creativeEvents && next.creativeEvents.length > allowed) {
      next.creativeEvents = [...next.creativeEvents]
        .sort((a, b) => a.start - b.start)
        .slice(0, allowed);
    }
    if (kit.ctas.length) {
      next.textSlots = next.textSlots.map((t) =>
        t.label === "CTA" ? { ...t, value: kit.ctas[0]! } : t,
      );
    }
  }

  if (copy) {
    const lines = copyLines(copy);
    const ctaValue = copy.cta.trim();
    const sorted = [...next.textSlots].sort((a, b) => a.start - b.start);
    const ctaSlot = sorted.find((t) => t.label === "CTA" || t.style === "cta_lockup");
    const body = sorted.filter((t) => t !== ctaSlot);

    const kept: TextSlot[] = [];
    body.forEach((slot, i) => {
      const line = lines[i];
      if (!line) return; // exact discipline: never invent copy
      const isGiant = slot.style === "giant_word" || slot.style === "oversized_hook";
      const value =
        copy.mode === "exact"
          ? line.value
          : copy.mode === "shorten"
            ? shorten(line.value, isGiant ? 14 : 42)
            : shorten(line.value, isGiant ? 18 : 60);
      kept.push({ ...slot, label: line.label, value });
    });
    if (ctaSlot && ctaValue) kept.push({ ...ctaSlot, value: ctaValue });
    next.textSlots = kept;
  }

  next = { ...next, tags: [...new Set([...(next.tags ?? []), ...(kit ? ["branded"] : [])])] };
  return next;
}

export function copyCoverage(spec: TemplateSpec, copy?: CopyKit | null) {
  if (!copy) return null;
  const available = copyLines(copy).length + (copy.cta.trim() ? 1 : 0);
  return { available, used: spec.textSlots.length };
}
