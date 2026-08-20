import { useCallback, useRef, useState } from "react";
import { Download, FileCode2, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildJob,
  EXPORT_FORMATS,
  type ExportFormat,
  type ExportQuality,
  type RenderStatus,
} from "@/lib/render/job";
import { buildFcpxml } from "@/lib/render/fcpxml";
import { downloadHandoff } from "@/lib/render/handoff";
import { brandById, copyKitById, useBrandStore } from "@/lib/brand/store";
import type { AudioTrack, MediaMap, TemplateSpec } from "@/lib/template/types";

interface Props {
  spec: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
  audio: AudioTrack | null;
}

const QUALITIES: { key: ExportQuality; label: string; crf: number; hint: string }[] = [
  { key: "standard", label: "Standard", crf: 22, hint: "social ready" },
  { key: "high", label: "High", crf: 16, hint: "full bitrate master" },
];

function download(name: string, content: string, mime: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function ExportDialog({ spec, media, textOverrides, audio }: Props) {
  const store = useBrandStore();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("vertical");
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [status, setStatus] = useState<RenderStatus>({ stage: "idle", progress: 0, message: "" });
  const timer = useRef<number | null>(null);

  const brand = brandById(store.activeBrandId);
  const copy = copyKitById(store.activeCopyId);

  const job = useCallback(
    () =>
      buildJob(
        spec,
        media,
        textOverrides,
        audio ? { name: audio.name, trimStart: audio.trimStart, volume: audio.volume } : null,
        { format, quality },
      ),
    [spec, media, textOverrides, audio, format, quality],
  );

  const start = useCallback(async () => {
    setOpen(true);
    setStatus({ stage: "preparing", progress: 3, message: "Preparing composition…" });
    const payload = job();
    payload.output.crf = QUALITIES.find((q) => q.key === quality)!.crf;

    try {
      // Ship the full-resolution source clips with the job — the worker never
      // sees the browser's blob URLs.
      const form = new FormData();
      const entries = Object.entries(media);
      let done = 0;
      for (const [slotId, asset] of entries) {
        const blob = await fetch(asset.url).then((r) => r.blob());
        form.append(`media:${slotId}`, blob, asset.name || slotId);
        done += 1;
        setStatus({
          stage: "uploading",
          progress: Math.round((done / Math.max(1, entries.length)) * 25),
          message: `Uploading full-resolution sources… ${done}/${entries.length}`,
        });
      }
      if (audio?.url) {
        const ab = await fetch(audio.url).then((r) => r.blob());
        form.append("audio", ab, audio.name || "audio");
      }
      form.append("job", JSON.stringify(payload));

      setStatus({ stage: "uploading", progress: 28, message: "Submitting render job…" });
      const res = await fetch("/api/public/render", { method: "POST", body: form });
      const data = (await res.json()) as { configured: boolean; jobId?: string; error?: string };
      if (!data.configured) {
        setStatus({
          stage: "error",
          progress: 0,
          message:
            "No render service connected. Deploy render-worker/ (Remotion + Chromium + ffmpeg) and set REMOTION_WORKER_URL — the deployment checklist is in render-worker/README.md.",
        });
        return;
      }
      if (!res.ok || !data.jobId) throw new Error(data.error ?? "Render worker rejected the job");

      const jobId = data.jobId;
      setStatus({ stage: "queued", progress: 30, message: "Queued on the render service…" });
      const poll = async () => {
        const s = (await fetch(`/api/public/render-status/${jobId}`).then((r) => r.json())) as {
          state?: string;
          progress?: number;
          url?: string;
          error?: string;
        };
        if (s.state === "done" && s.url) {
          setStatus({
            stage: "done",
            progress: 100,
            message: "Complete — H.264 MP4 ready",
            downloadUrl: s.url,
          });
          return;
        }
        if (s.state === "error") {
          setStatus({ stage: "error", progress: 0, message: s.error ?? "Render failed" });
          return;
        }
        const p = s.progress ?? 0;
        setStatus({
          stage: s.state === "queued" ? "queued" : p > 0.97 ? "encoding" : "rendering",
          progress: 30 + Math.round(p * 68),
          message:
            s.state === "queued"
              ? "Queued on the render service…"
              : p > 0.97
                ? "Encoding H.264…"
                : "Rendering frames…",
        });
        timer.current = window.setTimeout(() => void poll(), 1200);
      };
      void poll();
    } catch (err) {
      setStatus({
        stage: "error",
        progress: 0,
        message: err instanceof Error ? err.message : "Render failed",
      });
      toast.error("Export failed");
    }
  }, [job, media, audio, quality]);

  const active =
    status.stage === "preparing" ||
    status.stage === "uploading" ||
    status.stage === "queued" ||
    status.stage === "rendering" ||
    status.stage === "encoding";

  const fmt = EXPORT_FORMATS.find((f) => f.key === format)!;

  return (
    <>
      <Button onClick={() => void start()} className="font-semibold">
        <Download className="size-4" /> Export MP4
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v && timer.current) window.clearTimeout(timer.current);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Export · {fmt.width}×{fmt.height} H.264
            </DialogTitle>
            <DialogDescription>
              {spec.duration.toFixed(1)}s · {spec.fps}fps · {spec.mediaSlots.length} shots ·{" "}
              {(spec.creativeEvents ?? []).length} creative moments
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    format === f.key
                      ? "border-primary bg-primary/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="block font-semibold">{f.label}</span>
                  <span className="text-[10px] uppercase tracking-widest">
                    {f.width}×{f.height}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {QUALITIES.map((q) => (
                <button
                  key={q.key}
                  onClick={() => setQuality(q.key)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    quality === q.key
                      ? "border-primary bg-primary/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="block font-semibold">{q.label}</span>
                  <span className="text-[10px] uppercase tracking-widest">{q.hint}</span>
                </button>
              ))}
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${status.stage === "error" ? 0 : status.progress}%` }}
              />
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              {active && <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />}
              <span>
                <span className="uppercase tracking-widest text-[10px] text-foreground">
                  {status.stage === "idle" ? "" : status.stage}
                </span>{" "}
                {status.stage === "rendering" ? `${status.progress}% — ` : ""}
                {status.message}
              </span>
            </p>

            {status.downloadUrl && (
              <Button asChild className="w-full">
                <a href={status.downloadUrl} download>
                  <Download className="size-4" /> Download MP4
                </a>
              </Button>
            )}

            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                Export for finishing
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    download(
                      `${spec.name.toLowerCase().replace(/\s+/g, "-")}.fcpxml`,
                      buildFcpxml({ projectName: "Tempo", spec, media, audio }),
                      "application/xml",
                    );
                    toast.success("FCPXML exported");
                  }}
                >
                  <FileCode2 className="size-4" /> Final Cut XML
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    downloadHandoff(
                      {
                        spec,
                        media,
                        audio,
                        brand,
                        copy,
                        ...(status.downloadUrl ? { referenceUrl: status.downloadUrl } : {}),
                      },
                      `${spec.name.toLowerCase().replace(/\s+/g, "-")}-handoff.zip`,
                    );
                    toast.success("Handoff package exported");
                  }}
                >
                  <Package className="size-4" /> Handoff package
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
