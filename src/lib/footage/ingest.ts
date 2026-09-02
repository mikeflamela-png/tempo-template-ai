import { putMedia, mediaUrl } from "./db";
import { detectCuts, grabThumb, loadVideo } from "./detect";
import { addClips, addSource, projectClips } from "./store";
import type { Clip, SourceRecord } from "./types";

export interface IngestProgress {
  stage: "uploading" | "detecting" | "clips" | "ready";
  label: string;
  fraction: number;
}

const id = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function makeClip(
  projectId: string,
  sourceId: string,
  name: string,
  start: number,
  end: number,
  order: number,
): Clip {
  return {
    id: id("cl"),
    projectId,
    sourceId,
    name,
    start: Number(start.toFixed(3)),
    end: Number(end.toFixed(3)),
    in: Number(start.toFixed(3)),
    out: Number(end.toFixed(3)),
    rating: 0,
    favorite: false,
    rejected: false,
    shotType: null,
    order,
  };
}

/** One long video → many virtual subclips, no re-encoding, no file copies. */
export async function ingestStringout(
  projectId: string,
  file: File,
  onProgress: (p: IngestProgress) => void,
  sensitivity = 0.5,
): Promise<Clip[]> {
  onProgress({ stage: "uploading", label: "Reading video", fraction: 0.05 });
  const sourceId = id("src");
  await putMedia(sourceId, file);
  const url = await mediaUrl(sourceId);
  if (!url) throw new Error("Could not store this video");

  onProgress({ stage: "detecting", label: "Detecting shots", fraction: 0.1 });
  const { cuts, duration } = await detectCuts(url, {
    sensitivity,
    onProgress: (f) => onProgress({ stage: "detecting", label: "Detecting shots", fraction: 0.1 + f * 0.6 }),
  });

  const source: SourceRecord = {
    id: sourceId,
    projectId,
    name: file.name,
    duration,
    kind: "stringout",
    addedAt: Date.now(),
  };
  addSource(source);

  const bounds = [0, ...cuts, duration];
  const base = projectClips(projectId).length;
  const clips: Clip[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i]!;
    const b = bounds[i + 1]!;
    if (b - a < 0.35) continue;
    clips.push(makeClip(projectId, sourceId, `${file.name} · ${String(clips.length + 1).padStart(3, "0")}`, a, b, base + clips.length));
  }

  onProgress({ stage: "clips", label: `Creating ${clips.length} clips`, fraction: 0.72 });
  const video = await loadVideo(url);
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i]!;
    try {
      c.thumb = await grabThumb(video, c.start + Math.min(0.4, (c.end - c.start) / 2), 220);
    } catch {
      /* thumbnails are a nicety, never a blocker */
    }
    onProgress({
      stage: "clips",
      label: `Creating clips ${i + 1}/${clips.length}`,
      fraction: 0.72 + (i / Math.max(1, clips.length)) * 0.27,
    });
  }
  video.src = "";

  addClips(clips);
  onProgress({ stage: "ready", label: "Ready to review", fraction: 1 });
  return clips;
}

/** A pile of individual files → one clip each. */
export async function ingestClipFiles(
  projectId: string,
  files: File[],
  onProgress: (p: IngestProgress) => void,
): Promise<Clip[]> {
  const base = projectClips(projectId).length;
  const clips: Clip[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    onProgress({
      stage: "uploading",
      label: `Adding ${i + 1}/${files.length} — ${file.name}`,
      fraction: i / Math.max(1, files.length),
    });
    const sourceId = id("src");
    await putMedia(sourceId, file);
    const url = await mediaUrl(sourceId);
    if (!url) continue;
    let duration = 0;
    let thumb = "";
    try {
      const video = await loadVideo(url);
      duration = video.duration || 0;
      thumb = await grabThumb(video, Math.min(0.6, duration / 2), 220);
      video.src = "";
    } catch {
      continue;
    }
    addSource({
      id: sourceId,
      projectId,
      name: file.name,
      duration,
      kind: "clip",
      addedAt: Date.now(),
    });
    const clip = makeClip(projectId, sourceId, file.name, 0, duration, base + clips.length);
    clip.thumb = thumb;
    clips.push(clip);
    addClips([clip]);
  }
  onProgress({ stage: "ready", label: "Ready to review", fraction: 1 });
  return clips;
}
