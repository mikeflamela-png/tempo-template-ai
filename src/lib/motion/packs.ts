/**
 * MOTION KITS
 *
 * A curated, opinionated grouping of the raw kernel layer. Instead of "any of
 * 21 effects at random", generation picks a kit and stays inside it — that is
 * what makes output look art-directed rather than sampled.
 */
import type { TemplateSpec, Transition } from "@/lib/template/types";

export interface MotionPack {
  key: string;
  name: string;
  blurb: string;
  kernels: string[];
  transitions: Transition[];
  overlays: string[];
  /** maximum creative events per 10 seconds at full effect amount */
  density: number;
  restraint: string[];
}

export const MOTION_PACKS: MotionPack[] = [
  {
    key: "editorial_paper",
    name: "Editorial Paper",
    blurb: "Torn paper, crop marks, hand annotation. Magazine art department.",
    kernels: ["paper_rip", "crop_marks", "marker_circle", "editorial_numbers", "ripped_edge_wipe"],
    transitions: ["hard_cut", "mask_wipe", "film_splice", "wipe_left"],
    overlays: ["paper", "grain", "frame_line"],
    density: 4,
    restraint: ["one annotation per shot", "never two paper effects back to back"],
  },
  {
    key: "analog_film",
    name: "Analog Film",
    blurb: "Burns, halation, strip rushes, splices. 16mm energy.",
    kernels: ["film_burn", "light_leak", "film_strip_rush", "photocopy_flash", "ghost_trail"],
    transitions: ["film_splice", "flash", "blur", "hard_cut"],
    overlays: ["halation", "light_leak", "grain", "film_border"],
    density: 3,
    restraint: ["burns only on scene changes", "keep the spine readable"],
  },
  {
    key: "documentary_still",
    name: "Documentary Still",
    blurb: "Freeze frames, contact sheets, magnifiers, quiet marks.",
    kernels: ["freeze_annotation", "contact_sheet", "magnifier", "photo_stack", "crop_marks"],
    transitions: ["hard_cut", "blur", "wipe_up"],
    overlays: ["timestamp", "grain", "vignette"],
    density: 2,
    restraint: ["hold every freeze at least 0.6s", "no more than one grid moment"],
  },
  {
    key: "type_forward",
    name: "Type Forward",
    blurb: "Words as the主 event: crashes, pushes, drawn masks.",
    kernels: ["type_crash", "word_push", "mask_draw_on", "scribble_impact", "editorial_numbers"],
    transitions: ["hard_cut", "punch_zoom", "smear", "directional_blur"],
    overlays: ["flash", "bar_wipe", "noise"],
    density: 5,
    restraint: ["one word per beat", "type never overlaps type"],
  },
  {
    key: "kinetic_flash",
    name: "Kinetic Flash",
    blurb: "Shutter bursts, echoes, RGB separation. Loud and fast.",
    kernels: ["shutter_sequence", "frame_echo", "ghost_trail", "photocopy_flash", "type_crash"],
    transitions: ["whip", "rgb_split", "flash", "snap_zoom_out", "stretch"],
    overlays: ["chromatic", "flash", "rgb_separation", "noise"],
    density: 6,
    restraint: ["never three flashes in a row", "hold the last shot"],
  },
  {
    key: "quiet_luxury",
    name: "Quiet Luxury",
    blurb: "Texture washes, slow masks, almost no effects at all.",
    kernels: ["texture_wash", "mask_draw_on", "light_leak"],
    transitions: ["hard_cut", "blur", "mask_out"],
    overlays: ["vignette", "bloom", "grain"],
    density: 1,
    restraint: ["at most two moments in the whole edit", "never interrupt the hero shot"],
  },
];

export function packByKey(key?: string | null) {
  return MOTION_PACKS.find((p) => p.key === key);
}

/**
 * Constrains a spec's creative events + transitions to a motion kit and an
 * effect amount (0–10).
 */
export function applyMotionPack(
  spec: TemplateSpec,
  pack?: MotionPack | null,
  amount = 5,
): TemplateSpec {
  if (!pack) return spec;
  const max = Math.max(0, Math.round((pack.density * spec.duration) / 10 * (amount / 5)));
  const events = [...(spec.creativeEvents ?? [])]
    .sort((a, b) => a.start - b.start)
    .slice(0, max)
    .map((e, i) => ({
      ...e,
      kernel: pack.kernels.includes(e.kernel) ? e.kernel : pack.kernels[i % pack.kernels.length]!,
    }));

  const mediaSlots = spec.mediaSlots.map((s, i) => ({
    ...s,
    transitionOut:
      s.transitionOut && pack.transitions.includes(s.transitionOut)
        ? s.transitionOut
        : amount < 3
          ? ("hard_cut" as Transition)
          : pack.transitions[i % pack.transitions.length]!,
  }));

  const overlays = spec.overlays.filter(
    (o) => pack.overlays.includes(o.type) || o.type === "progress" || o.type === "flash",
  );

  return {
    ...spec,
    creativeEvents: events,
    mediaSlots,
    overlays,
    tags: [...new Set([...(spec.tags ?? []), pack.name])],
  };
}
