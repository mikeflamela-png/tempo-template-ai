import type { MediaMap, TemplateSpec } from "@/lib/template/types";

export type RenderStage =
  | "idle"
  | "preparing"
  | "uploading"
  | "rendering"
  | "done"
  | "error";

export interface RenderJobPayload {
  spec: TemplateSpec;
  textOverrides: Record<string, string>;
  media: Record<string, { name: string; kind: string; inPoint?: number; zoom?: number }>;
  audio: { name: string; trimStart: number; volume: number } | null;
  output: {
    width: number;
    height: number;
    fps: number;
    codec: "h264";
    container: "mp4";
    crf?: number;
  };
}

export interface RenderStatus {
  stage: RenderStage;
  progress: number;
  message: string;
  downloadUrl?: string;
}

export function buildJob(
  spec: TemplateSpec,
  media: MediaMap,
  textOverrides: Record<string, string>,
  audio: { name: string; trimStart: number; volume: number } | null,
): RenderJobPayload {
  return {
    spec,
    textOverrides,
    media: Object.fromEntries(
      Object.entries(media).map(([k, v]) => [
        k,
        { name: v.name, kind: v.kind, inPoint: v.inPoint ?? 0, zoom: v.zoom ?? 1 },
      ]),
    ),
    audio,
    output: {
      width: spec.width,
      height: spec.height,
      fps: spec.fps,
      codec: "h264",
      container: "mp4",
    },
  };
}
