/**
 * CREATIVE DIFF
 *
 * A human-readable "what changed" between two TemplateSpecs — used by the
 * Variation Matrix to explain each variant and by Keep/Change to show what
 * was actually regenerated.
 */
import type { TemplateSpec, TextSlot } from "@/lib/template/types";

export interface DiffRow {
  label: string;
  change: "same" | "changed";
  detail: string;
}

function textByLabel(spec: TemplateSpec, label: string): TextSlot | undefined {
  return spec.textSlots.find((t) => t.label.toUpperCase() === label);
}

function ctaSlot(spec: TemplateSpec): TextSlot | undefined {
  return spec.textSlots.find((t) => t.label === "CTA" || t.style === "cta_lockup");
}

function spine(spec: TemplateSpec) {
  return [...spec.mediaSlots.filter((s) => s.layout === "full")].sort((a, b) => a.start - b.start);
}

function row(label: string, a: unknown, b: unknown, describe: (a: unknown, b: unknown) => string): DiffRow {
  const same = JSON.stringify(a) === JSON.stringify(b);
  return { label, change: same ? "same" : "changed", detail: same ? "unchanged" : describe(a, b) };
}

export function creativeDiff(a: TemplateSpec, b: TemplateSpec): DiffRow[] {
  const rows: DiffRow[] = [];

  rows.push(
    row("Blueprint", a.blueprintId, b.blueprintId, () =>
      `${a.blueprintId ?? "freeform"} → ${b.blueprintId ?? "freeform"}`,
    ),
  );

  const aHook = textByLabel(a, "HOOK")?.value;
  const bHook = textByLabel(b, "HOOK")?.value;
  rows.push(row("Hook copy", aHook, bHook, () => `"${aHook ?? "—"}" → "${bHook ?? "—"}"`));

  const aHead = textByLabel(a, "HEADLINE")?.value;
  const bHead = textByLabel(b, "HEADLINE")?.value;
  rows.push(row("Headline copy", aHead, bHead, () => `"${aHead ?? "—"}" → "${bHead ?? "—"}"`));

  rows.push(
    row(
      "Opener",
      [spine(a)[0]?.purpose, spine(a)[0]?.animationIn],
      [spine(b)[0]?.purpose, spine(b)[0]?.animationIn],
      () => `${spine(a)[0]?.animationIn ?? "none"} → ${spine(b)[0]?.animationIn ?? "none"}`,
    ),
  );

  rows.push(
    row(
      "Footage order",
      spine(a).map((s) => s.purpose),
      spine(b).map((s) => s.purpose),
      () => `${spine(a).map((s) => s.purpose).join(",")} → ${spine(b).map((s) => s.purpose).join(",")}`,
    ),
  );

  rows.push(
    row(
      "Transitions / motion",
      a.mediaSlots.map((s) => s.transitionOut),
      b.mediaSlots.map((s) => s.transitionOut),
      () => "transition or creative-event kernels changed",
    ),
  );

  const aCta = ctaSlot(a)?.value;
  const bCta = ctaSlot(b)?.value;
  rows.push(row("CTA", aCta, bCta, () => `"${aCta ?? "—"}" → "${bCta ?? "—"}"`));

  rows.push(
    row("Typography", a.fontKey, b.fontKey, () => `${a.fontKey ?? "default"} → ${b.fontKey ?? "default"}`),
  );

  const aEnd = spine(a)[spine(a).length - 1];
  const bEnd = spine(b)[spine(b).length - 1];
  rows.push(
    row("Ending", aEnd?.animationOut, bEnd?.animationOut, () => `${aEnd?.animationOut ?? "none"} → ${bEnd?.animationOut ?? "none"}`),
  );

  rows.push(
    row(
      "Pacing",
      spine(a).map((s) => s.duration),
      spine(b).map((s) => s.duration),
      () => "shot timing redistributed",
    ),
  );

  return rows;
}
