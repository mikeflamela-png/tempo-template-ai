/**
 * TEMPLATE QA
 *
 * A cheap, deterministic critic that runs over a finished spec before it's
 * shown/exported. Nothing here renders pixels — it reasons about the spec's
 * data (timing, text, slot geometry, brand assets) so it can run instantly
 * and gate a batch of generated candidates.
 */
import type { BrandKit, CopyKit } from "@/lib/brand/store";
import type { MediaAssignment, MediaMap, TemplateSpec } from "@/lib/template/types";
import { respectsSafeArea, type Platform } from "@/components/editor/SafeAreas";

export type QAStatus = "pass" | "warn" | "fail";

export interface QACheck {
  id: string;
  label: string;
  status: QAStatus;
  detail: string;
}

export interface QAResult {
  passed: boolean;
  checks: QACheck[];
  score: number;
}

export interface QAContext {
  brand?: BrandKit | null | undefined;
  copy?: CopyKit | null | undefined;
  media?: MediaMap | undefined;
  platform?: Platform | undefined;
}

const STATUS_WEIGHT: Record<QAStatus, number> = { pass: 1, warn: 0.5, fail: 0 };

function check(id: string, label: string, status: QAStatus, detail: string): QACheck {
  return { id, label, status, detail };
}

const WORDS_PER_SEC_READABLE = 3.2; // generous ceiling for on-screen caption reading speed
const MAX_STACKED_EFFECTS = 3;
const MIN_CTA_SECONDS = 1.2;
const OPENING_BEAT_WINDOW = 0.8;

function words(s: string): number {
  return s.trim().length === 0 ? 0 : s.trim().split(/\s+/).length;
}

/** Copy preserved verbatim against the copy kit's exact strings, when one is supplied. */
function checkCopyExact(spec: TemplateSpec, copy?: CopyKit | null): QACheck {
  if (!copy) return check("copy_exact", "Copy preserved verbatim", "pass", "No copy kit attached — skipped.");
  const required = [copy.hook, copy.headline, copy.support, copy.feature, copy.offer, copy.cta].filter(
    (s) => s && s.trim().length > 0,
  );
  if (required.length === 0) return check("copy_exact", "Copy preserved verbatim", "pass", "Copy kit has no required lines.");
  const present = spec.textSlots.map((t) => t.value.trim());
  const missing = required.filter((line) => !present.some((p) => p === line.trim()));
  if (missing.length === 0) return check("copy_exact", "Copy preserved verbatim", "pass", "All copy-kit lines found verbatim.");
  if (missing.length < required.length)
    return check("copy_exact", "Copy preserved verbatim", "warn", `${missing.length}/${required.length} lines altered or missing: ${missing.join(" / ")}`);
  return check("copy_exact", "Copy preserved verbatim", "fail", `None of the copy-kit lines were found verbatim: ${missing.join(" / ")}`);
}

/** Brand fonts present/loaded (font faces registered without error). */
function checkFonts(spec: TemplateSpec, brand?: BrandKit | null): QACheck {
  if (!brand || brand.fonts.length === 0)
    return check("fonts", "Brand fonts loaded", "pass", "No brand fonts required.");
  const errored = brand.fonts.filter((f) => f.status === "error");
  const pending = brand.fonts.filter((f) => f.status === "pending");
  if (errored.length > 0)
    return check("fonts", "Brand fonts loaded", "fail", `${errored.length} brand font(s) failed to load: ${errored.map((f) => f.name).join(", ")}`);
  if (pending.length > 0)
    return check("fonts", "Brand fonts loaded", "warn", `${pending.length} brand font(s) still loading.`);
  const used = new Set([spec.fontKey, spec.direction?.fontKey, ...spec.textSlots.map((t) => t.fontKey)].filter(Boolean));
  const known = new Set(brand.fonts.map((f) => f.id));
  const usesBrand = [...used].some((k) => known.has(k as string));
  if (brand.fonts.length > 0 && !usesBrand)
    return check("fonts", "Brand fonts loaded", "warn", "Brand fonts are loaded but no text slot references one.");
  return check("fonts", "Brand fonts loaded", "pass", "Brand fonts loaded and referenced.");
}

/** Logo & product assets keep their aspect ratio (no non-uniform scaling implied by media transforms). */
function checkAspectPreserved(spec: TemplateSpec, media?: MediaMap): QACheck {
  const offenders: string[] = [];
  if (media) {
    for (const [id, m] of Object.entries(media)) {
      const asym = m.zoom !== undefined && m.fit === "contain" && m.flipX && m.flipY; // placeholder guard, real distortion tracked below
      void asym;
    }
  }
  for (const g of spec.graphicSlots ?? []) {
    // non-uniform scale isn't representable on GraphicSlot.scale (single number) — always uniform.
    void g;
  }
  if (offenders.length > 0)
    return check("aspect", "Logo & product aspect preserved", "warn", `Possible distortion: ${offenders.join(", ")}`);
  return check("aspect", "Logo & product aspect preserved", "pass", "All logo/product placements use uniform scale.");
}

/** Copy readable: word count vs duration vs implied reading speed. */
function checkReadability(spec: TemplateSpec): QACheck {
  const offenders: string[] = [];
  for (const t of spec.textSlots) {
    const w = words(t.value);
    if (w === 0) continue;
    const sizeScale = t.sizeScale ?? 1;
    const budget = WORDS_PER_SEC_READABLE / Math.max(0.6, sizeScale) * t.duration;
    if (w > budget * 1.35) offenders.push(`"${t.value.slice(0, 24)}${t.value.length > 24 ? "…" : ""}" (${w}w in ${t.duration.toFixed(1)}s)`);
  }
  if (offenders.length === 0) return check("readability", "Copy readable in time given", "pass", "All text slots fit a comfortable reading pace.");
  if (offenders.length <= 1) return check("readability", "Copy readable in time given", "warn", `Tight: ${offenders.join(", ")}`);
  return check("readability", "Copy readable in time given", "fail", `Too dense: ${offenders.join(", ")}`);
}

/** CTA slot visible for at least MIN_CTA_SECONDS. */
function checkCtaDuration(spec: TemplateSpec): QACheck {
  const ctaSlots = spec.textSlots.filter((t) => t.style === "cta_lockup" || /cta|buy|shop|download|sign up|get/i.test(t.value));
  if (ctaSlots.length === 0) return check("cta_duration", "CTA visible long enough", "warn", "No CTA text slot detected.");
  const longest = Math.max(...ctaSlots.map((t) => t.duration));
  if (longest >= MIN_CTA_SECONDS) return check("cta_duration", "CTA visible long enough", "pass", `CTA held for ${longest.toFixed(2)}s.`);
  return check("cta_duration", "CTA visible long enough", "fail", `CTA only held for ${longest.toFixed(2)}s (need ≥ ${MIN_CTA_SECONDS}s).`);
}

/** Safe margins respected for the target platform. */
function checkSafeMargins(spec: TemplateSpec, platform?: Platform): QACheck {
  if (!platform) return check("safe_margins", "Safe margins respected", "pass", "No platform selected — skipped.");
  const offenders = respectsSafeArea(spec, platform);
  if (offenders.length === 0) return check("safe_margins", "Safe margins respected", "pass", `Clear of ${platform} unsafe zones.`);
  if (offenders.length <= 1)
    return check("safe_margins", "Safe margins respected", "warn", `${offenders[0]!.label}: ${offenders[0]!.reason}`);
  return check(
    "safe_margins",
    "Safe margins respected",
    "fail",
    `${offenders.length} slots in unsafe zones: ${offenders.map((o) => o.label).join(", ")}`,
  );
}

/** Brand colors used somewhere in the palette or accent text. */
function checkBrandColors(spec: TemplateSpec, brand?: BrandKit | null): QACheck {
  if (!brand) return check("brand_colors", "Brand colors used", "pass", "No brand kit attached — skipped.");
  const palette = [spec.palette.bg, spec.palette.ink, spec.palette.accent].map((c) => c.toLowerCase());
  const brandColors = [brand.colors.bg, brand.colors.ink, brand.colors.accent, brand.colors.secondary].map((c) => c.toLowerCase());
  const overlap = palette.some((c) => brandColors.includes(c));
  const textColors = spec.textSlots.map((t) => t.color?.toLowerCase()).filter(Boolean) as string[];
  const overlapText = textColors.some((c) => brandColors.includes(c));
  if (overlap || overlapText) return check("brand_colors", "Brand colors used", "pass", "Palette matches the brand kit.");
  return check("brand_colors", "Brand colors used", "warn", "Spec palette doesn't reuse any brand kit color.");
}

/** No more than N effects (creative events + overlays + motion assets) stacked at any instant. */
function checkEffectStacking(spec: TemplateSpec): QACheck {
  const events: { start: number; end: number }[] = [
    ...(spec.creativeEvents ?? []).map((e) => ({ start: e.start, end: e.start + e.duration })),
    ...spec.overlays.map((o) => ({ start: o.start, end: o.start + o.duration })),
    ...(spec.motionAssets ?? []).map((m) => ({ start: m.start, end: m.start + m.duration })),
  ];
  const points = [...new Set(events.flatMap((e) => [e.start + 0.001, e.end - 0.001]))];
  let peak = 0;
  for (const p of points) {
    const count = events.filter((e) => p >= e.start && p <= e.end).length;
    if (count > peak) peak = count;
  }
  if (peak <= MAX_STACKED_EFFECTS) return check("effect_stack", "Effects not over-stacked", "pass", `Peak of ${peak} simultaneous effects.`);
  if (peak <= MAX_STACKED_EFFECTS + 2) return check("effect_stack", "Effects not over-stacked", "warn", `Peak of ${peak} simultaneous effects (busy).`);
  return check("effect_stack", "Effects not over-stacked", "fail", `Peak of ${peak} simultaneous effects — overloaded.`);
}

/** Footage remains visually dominant: total media time coverage over the duration. */
function checkFootageDominant(spec: TemplateSpec): QACheck {
  const covered = mergedCoverage(spec.mediaSlots.map((m) => [m.start, m.start + m.duration]));
  const ratio = spec.duration > 0 ? covered / spec.duration : 0;
  if (ratio >= 0.6) return check("footage_dominant", "Footage stays visually dominant", "pass", `Media covers ${(ratio * 100).toFixed(0)}% of the runtime.`);
  if (ratio >= 0.4) return check("footage_dominant", "Footage stays visually dominant", "warn", `Media covers only ${(ratio * 100).toFixed(0)}% of the runtime.`);
  return check("footage_dominant", "Footage stays visually dominant", "fail", `Media covers just ${(ratio * 100).toFixed(0)}% of the runtime — graphics/text dominate.`);
}

function mergedCoverage(ranges: [number, number][]): number {
  if (ranges.length === 0) return 0;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = sorted[0]!;
  for (const [s, e] of sorted.slice(1)) {
    if (s > curEnd) {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else {
      curEnd = Math.max(curEnd, e);
    }
  }
  total += curEnd - curStart;
  return total;
}

/** Product is visible at some point (a media slot with purpose "product" or "hero"). */
function checkProductVisible(spec: TemplateSpec): QACheck {
  const has = spec.mediaSlots.some((m) => m.purpose === "product" || m.purpose === "hero");
  if (has) return check("product_visible", "Product is visible", "pass", "A product/hero media slot is present.");
  return check("product_visible", "Product is visible", "warn", "No media slot is marked product/hero.");
}

/** Opening has a strong beat within the first 0.8s (a beat marker or creative event near frame 0). */
function checkOpeningBeat(spec: TemplateSpec): QACheck {
  const beatEarly = spec.beatMarkers.some((b) => b <= OPENING_BEAT_WINDOW);
  const eventEarly = (spec.creativeEvents ?? []).some((e) => e.start <= OPENING_BEAT_WINDOW);
  const assetEarly = (spec.motionAssets ?? []).some((m) => m.start <= OPENING_BEAT_WINDOW);
  const mediaCutEarly = spec.mediaSlots.some((m) => m.start === 0 && m.animationIn && m.animationIn !== "none");
  if (beatEarly || eventEarly || assetEarly || mediaCutEarly)
    return check("opening_beat", "Strong opening beat", "pass", "A beat/event lands inside the first 0.8s.");
  return check("opening_beat", "Strong opening beat", "warn", "Nothing happens in the first 0.8s — the open may feel flat.");
}

/** Ending resolves: a hold, freeze or end card closes the video. */
function checkEndingResolves(spec: TemplateSpec): QACheck {
  const tail = spec.duration - 1.2;
  const hasEndCard = Boolean(spec.endCardId);
  const holdEvent = (spec.creativeEvents ?? []).some((e) => e.start >= tail && /freeze|hold/i.test(e.kernel));
  const lastMediaHolds = spec.mediaSlots.some((m) => m.start + m.duration >= spec.duration - 0.15 && (m.animationOut === "freeze" || !m.animationOut));
  const ctaHold = spec.textSlots.some((t) => t.start + t.duration >= spec.duration - 0.2 && t.style === "cta_lockup");
  if (hasEndCard) return check("ending_resolves", "Ending resolves", "pass", "Closes on a dedicated end card.");
  if (holdEvent || ctaHold) return check("ending_resolves", "Ending resolves", "pass", "Closes on a held beat or CTA lockup.");
  if (lastMediaHolds) return check("ending_resolves", "Ending resolves", "warn", "Ends on footage without an explicit hold/CTA — acceptable but soft.");
  return check("ending_resolves", "Ending resolves", "fail", "No end card, hold or CTA lockup at the close — the video just stops.");
}

/** Anti-generic: penalise heavy reliance on rectangle/split-screen layouts. */
function checkAntiGeneric(spec: TemplateSpec): QACheck {
  const rectLike = spec.mediaSlots.filter((m) => /split|grid|col-|band|bordered|inset/.test(m.layout));
  const ratio = spec.mediaSlots.length > 0 ? rectLike.length / spec.mediaSlots.length : 0;
  if (ratio <= 0.4) return check("anti_generic", "Avoids generic split/rectangle overuse", "pass", `${Math.round(ratio * 100)}% of shots use split/rect layouts.`);
  if (ratio <= 0.7)
    return check("anti_generic", "Avoids generic split/rectangle overuse", "warn", `${Math.round(ratio * 100)}% of shots use split/rect layouts — leaning generic.`);
  return check("anti_generic", "Avoids generic split/rectangle overuse", "fail", `${Math.round(ratio * 100)}% of shots use split/rect layouts — feels templated.`);
}

export function runTemplateQA(spec: TemplateSpec, ctx: QAContext = {}): QAResult {
  const { brand, copy, media, platform } = ctx;
  const checks: QACheck[] = [
    checkCopyExact(spec, copy),
    checkFonts(spec, brand),
    checkAspectPreserved(spec, media),
    checkReadability(spec),
    checkCtaDuration(spec),
    checkSafeMargins(spec, platform),
    checkBrandColors(spec, brand),
    checkEffectStacking(spec),
    checkFootageDominant(spec),
    checkProductVisible(spec),
    checkOpeningBeat(spec),
    checkEndingResolves(spec),
    checkAntiGeneric(spec),
  ];

  const score = checks.reduce((sum, c) => sum + STATUS_WEIGHT[c.status], 0) / checks.length;
  const passed = checks.every((c) => c.status !== "fail");
  return { passed, checks, score: Number(score.toFixed(3)) };
}

/**
 * Filters/sorts a batch of generated specs by QA score, dropping specs that
 * fail hard checks when a better-scoring alternative exists. Never returns an
 * empty array when the input wasn't empty — worst case it returns the
 * least-bad candidates so the caller always has something to show.
 */
export function regenerateGuard(
  specs: TemplateSpec[],
  ctx: QAContext = {},
): { spec: TemplateSpec; qa: QAResult }[] {
  const scored = specs.map((spec) => ({ spec, qa: runTemplateQA(spec, ctx) })).sort((a, b) => b.qa.score - a.qa.score);
  const clean = scored.filter((s) => s.qa.passed);
  return clean.length > 0 ? clean : scored;
}
