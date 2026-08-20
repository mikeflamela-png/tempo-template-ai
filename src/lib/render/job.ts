import type { MediaMap, TemplateSpec } from "@/lib/template/types";

export type RenderStage =
  | "idle"
  | "preparing"
  | "uploading"
  | "queued"
  | "rendering"
  | "encoding"
  | "done"
  | "error";

export type ExportFormat = "vertical" | "square" | "landscape";

export const EXPORT_FORMATS: { key: ExportFormat; label: string; width: number; height: number }[] = [
  { key: "vertical", label: "Vertical Social", width: 1080, height: 1920 },
  { key: "square", label: "Square", width: 1080, height: 1080 },
  { key: "landscape", label: "Landscape", width: 1920, height: 1080 },
];

export type ExportQuality = "standard" | "high";

export interface RenderJobPayload {
  spec: TemplateSpec;
  /** uploaded motion / brand asset descriptors, keyed by asset id */
  assetMeta?: Record<string, { kind: string; fileName: string; loop?: boolean; speed?: number }>;
  /** uploaded brand fonts */
  fonts?: { key: string; family: string; fileName: string }[];
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
    quality?: ExportQuality;
    format?: ExportFormat;
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
  output?: { format?: ExportFormat; quality?: ExportQuality },
): RenderJobPayload {
  const fmt = EXPORT_FORMATS.find((f) => f.key === (output?.format ?? "vertical")) ?? EXPORT_FORMATS[0]!;
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
      width: output?.format ? fmt.width : spec.width,
      height: output?.format ? fmt.height : spec.height,
      quality: output?.quality ?? "high",
      format: output?.format ?? "vertical",
      fps: spec.fps,
      codec: "h264",
      container: "mp4",
    },
  };
}
