/**
 * EXPORT HANDOFF PACKAGE
 *
 * Everything a finishing artist needs next to the reference MP4: the timeline,
 * the media map, a copy sheet, the fonts and brand assets used, the music, the
 * edit notes and the list of Tempo effects that have to be baked because no NLE
 * understands them. Written as a plain (uncompressed) ZIP so it downloads as a
 * single file with no dependency.
 */
import type { AudioTrack, MediaMap, TemplateSpec } from "@/lib/template/types";
import type { BrandKit, CopyKit } from "@/lib/brand/store";
import { buildFcpxml } from "./fcpxml";

export interface HandoffInput {
  spec: TemplateSpec;
  media: MediaMap;
  audio?: AudioTrack | null;
  brand?: BrandKit | null;
  copy?: CopyKit | null;
  referenceUrl?: string;
}

export function buildHandoffFiles(input: HandoffInput): { name: string; content: string }[] {
  const { spec, media, audio, brand, copy, referenceUrl } = input;

  const timeline = {
    name: spec.name,
    duration: spec.duration,
    fps: spec.fps,
    resolution: `${spec.width}x${spec.height}`,
    blueprintId: spec.blueprintId ?? null,
    clips: [...spec.mediaSlots]
      .sort((a, b) => a.start - b.start)
      .map((s) => ({
        id: s.id,
        label: s.label,
        purpose: s.purpose,
        layout: s.layout,
        timelineIn: +s.start.toFixed(3),
        timelineOut: +(s.start + s.duration).toFixed(3),
        source: media[s.id]?.name ?? null,
        sourceIn: media[s.id]?.inPoint ?? 0,
        sourceOut: (media[s.id]?.inPoint ?? 0) + s.duration,
        scale: media[s.id]?.zoom ?? 1,
        position: { x: media[s.id]?.offsetX ?? 0, y: media[s.id]?.offsetY ?? 0 },
        rotation: media[s.id]?.rotation ?? 0,
        opacity: media[s.id]?.opacity ?? 1,
        speed: media[s.id]?.speed ?? 1,
        transitionOut: s.transitionOut ?? "hard_cut",
      })),
    text: spec.textSlots.map((t) => ({
      label: t.label,
      value: t.value,
      in: +t.start.toFixed(3),
      out: +(t.start + t.duration).toFixed(3),
      style: t.style,
      position: t.position,
      align: t.align ?? "left",
    })),
    graphics: (spec.graphicSlots ?? []).map((g) => ({
      kind: g.kind,
      text: g.text ?? null,
      in: +g.start.toFixed(3),
      out: +(g.start + g.duration).toFixed(3),
    })),
    markers: spec.beatMarkers.map((t) => +t.toFixed(3)),
    music: audio
      ? { file: audio.name, trimStart: audio.trimStart, volume: audio.volume, bpm: audio.beatMap?.bpm ?? null }
      : null,
  };

  const bake = [
    ...(spec.creativeEvents ?? []).map((e) => ({
      at: +e.start.toFixed(3),
      duration: +e.duration.toFixed(3),
      what: e.label ?? e.kernel,
      note: "Tempo creative event — bake from the reference MP4 over this range.",
    })),
    ...(spec.motionAssets ?? []).map((m) => ({
      at: +m.start.toFixed(3),
      duration: +m.duration.toFixed(3),
      what: m.label ?? m.assetId,
      note: "Imported motion asset — original file is in /motion of this package's media list.",
    })),
  ];

  const copySheet = [
    `COPY SHEET — ${spec.name}`,
    "",
    ...spec.textSlots
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((t) => `${t.start.toFixed(2)}s  [${t.label}]  ${t.value}`),
    "",
    copy ? `Copy kit: ${copy.name} (mode: ${copy.mode})` : "No copy kit attached.",
  ].join("\n");

  const notes = [
    `EDIT NOTES — ${spec.name}`,
    "",
    `Blueprint: ${spec.blueprintId ?? "n/a"}`,
    `Concept: ${spec.direction?.conceptName ?? spec.creativeProfile.family}`,
    `Idea: ${spec.direction?.creativeIdea ?? "—"}`,
    `Pacing: ${spec.creativeProfile.pacing}`,
    `Opening: ${spec.direction?.openingStrategy ?? "—"}`,
    `Ending: ${spec.direction?.endingStrategy ?? "—"}`,
    "",
    "Fonts used:",
    ...(brand?.fonts ?? []).map((f) => `  - ${f.name} (${f.role}) — ${f.fileName}`),
    "",
    "Brand assets used:",
    ...(brand?.assets ?? []).map((a) => `  - ${a.name} [${a.kind}] — ${a.fileName} (${a.rule})`),
    "",
    "Effects to bake:",
    ...bake.map((b) => `  - ${b.at}s (+${b.duration}s) ${b.what}`),
    "",
    referenceUrl ? `Reference MP4: ${referenceUrl}` : "Reference MP4: render and place next to this package.",
  ].join("\n");

  return [
    { name: "timeline.json", content: JSON.stringify(timeline, null, 2) },
    { name: "tempo.fcpxml", content: buildFcpxml({ projectName: "Tempo", spec, media, ...(audio ? { audio } : {}) }) },
    { name: "copy-sheet.txt", content: copySheet },
    { name: "edit-notes.txt", content: notes },
    {
      name: "media-map.json",
      content: JSON.stringify(
        Object.fromEntries(
          Object.entries(media).map(([k, v]) => [
            k,
            { file: v.name, kind: v.kind, inPoint: v.inPoint ?? 0, zoom: v.zoom ?? 1 },
          ]),
        ),
        null,
        2,
      ),
    },
    { name: "bake-list.json", content: JSON.stringify(bake, null, 2) },
  ];
}

/* ---------- minimal stored (uncompressed) ZIP writer ---------- */

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

export function zipFiles(files: { name: string; content: string }[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u32 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
  const u16 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255]);
  const cat = (parts: Uint8Array[]) => {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  };

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const data = enc.encode(file.content);
    const crc = crc32(data);
    const local = cat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ]);
    chunks.push(local);
    central.push(
      cat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ]),
    );
    offset += local.length;
  }

  const centralBytes = cat(central);
  const end = cat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralBytes.length),
    u32(offset),
    u16(0),
  ]);
  return new Blob([cat(chunks), centralBytes, end], { type: "application/zip" });
}

export function downloadHandoff(input: HandoffInput, fileName = "tempo-handoff.zip") {
  const blob = zipFiles(buildHandoffFiles(input));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
