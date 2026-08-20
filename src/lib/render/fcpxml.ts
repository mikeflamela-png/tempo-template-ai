/**
 * EXPORT FOR FINISHING — Final Cut Pro XML (FCPXML 1.10).
 *
 * Tempo's primary output is a finished MP4, but an edit that goes to a
 * finishing suite needs the structure back: clip order, source references,
 * in/out points, transforms, text and music. Custom Tempo effects that have no
 * NLE equivalent are exported as markers plus a note so they can be baked from
 * the reference MP4 instead of being silently lost.
 */
import type { AudioTrack, MediaMap, TemplateSpec } from "@/lib/template/types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** FCPXML wants rational time: seconds -> "N/Ds". */
function rt(seconds: number, fps: number) {
  const frames = Math.max(0, Math.round(seconds * fps));
  return `${frames * 100}/${fps * 100}s`;
}

export interface FinishingOptions {
  projectName: string;
  spec: TemplateSpec;
  media: MediaMap;
  audio?: AudioTrack | null;
}

export function buildFcpxml({ projectName, spec, media, audio }: FinishingOptions): string {
  const fps = spec.fps;
  const slots = [...spec.mediaSlots].sort((a, b) => a.start - b.start);

  const assets: string[] = [];
  const assetIdBySlot = new Map<string, string>();
  let n = 1;
  for (const slot of slots) {
    const asset = media[slot.id];
    if (!asset) continue;
    const id = `r${++n}`;
    assetIdBySlot.set(slot.id, id);
    assets.push(
      `    <asset id="${id}" name="${esc(asset.name || slot.id)}" start="0s" hasVideo="1" ` +
        `hasAudio="${asset.kind === "video" ? 1 : 0}" format="r1" duration="${rt(Math.max(slot.duration * 2, 10), fps)}">` +
        `<media-rep kind="original-media" src="file://./media/${esc(asset.name || slot.id)}"/></asset>`,
    );
  }
  let audioId: string | null = null;
  if (audio) {
    audioId = `r${++n}`;
    assets.push(
      `    <asset id="${audioId}" name="${esc(audio.name)}" start="0s" hasAudio="1" ` +
        `duration="${rt(audio.duration, fps)}"><media-rep kind="original-media" src="file://./media/${esc(audio.name)}"/></asset>`,
    );
  }

  const clips = slots
    .map((slot) => {
      const id = assetIdBySlot.get(slot.id);
      const asset = media[slot.id];
      if (!id || !asset) return "";
      const inPoint = asset.inPoint ?? 0;
      const zoom = asset.zoom ?? 1;
      const scale = `${zoom} ${zoom}`;
      const pos = `${(asset.offsetX ?? 0) * (spec.width / 100)} ${(asset.offsetY ?? 0) * (spec.height / 100)}`;
      return (
        `        <asset-clip name="${esc(slot.label)}" ref="${id}" offset="${rt(slot.start, fps)}" ` +
        `start="${rt(inPoint, fps)}" duration="${rt(slot.duration, fps)}" ` +
        `tcFormat="NDF"><adjust-transform position="${pos}" scale="${scale}" ` +
        `rotation="${asset.rotation ?? 0}"/></asset-clip>`
      );
    })
    .filter(Boolean)
    .join("\n");

  const titles = spec.textSlots
    .map(
      (t, i) =>
        `        <title name="${esc(t.label || `Text ${i + 1}`)}" lane="1" offset="${rt(t.start, fps)}" ` +
        `duration="${rt(t.duration, fps)}" ref="r1"><text><text-style>${esc(t.value)}</text-style></text></title>`,
    )
    .join("\n");

  const audioClip = audioId
    ? `        <asset-clip name="${esc(audio!.name)}" lane="-1" ref="${audioId}" offset="0s" ` +
      `start="${rt(audio!.trimStart, fps)}" duration="${rt(spec.duration, fps)}" audioRole="music"/>`
    : "";

  const markers = [
    ...(spec.creativeEvents ?? []).map((e) => ({
      at: e.start,
      note: `TEMPO EFFECT ${e.kernel}${e.label ? ` — ${e.label}` : ""} (bake from reference MP4)`,
    })),
    ...(spec.motionAssets ?? []).map((m) => ({
      at: m.start,
      note: `TEMPO MOTION ASSET ${m.label ?? m.assetId}`,
    })),
    ...spec.beatMarkers.map((at) => ({ at, note: "beat" })),
  ]
    .sort((a, b) => a.at - b.at)
    .map((m) => `        <marker start="${rt(m.at, fps)}" duration="${rt(1 / fps, fps)}" value="${esc(m.note)}"/>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="r1" name="FFVideoFormat${spec.height}p${fps}" frameDuration="100/${fps * 100}s" width="${spec.width}" height="${spec.height}"/>
${assets.join("\n")}
  </resources>
  <library name="${esc(projectName)}">
    <event name="${esc(projectName)}">
      <project name="${esc(spec.name)}">
        <sequence format="r1" duration="${rt(spec.duration, fps)}" tcStart="0s" tcFormat="NDF">
          <spine>
${clips}
${titles}
${audioClip}
${markers}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}
