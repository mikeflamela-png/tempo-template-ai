import { useCallback, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildJob, type RenderStatus } from "@/lib/render/job";
import type { AudioTrack, MediaMap, TemplateSpec } from "@/lib/template/types";

interface Props {
  spec: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
  audio: AudioTrack | null;
}

const QUALITIES = [
  { key: "draft", label: "Draft", crf: 26, hint: "fast" },
  { key: "standard", label: "Standard", crf: 20, hint: "social ready" },
  { key: "master", label: "Master", crf: 15, hint: "highest bitrate" },
] as const;

export function ExportDialog({ spec, media, textOverrides, audio }: Props) {
  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useState<(typeof QUALITIES)[number]["key"]>("standard");
  const [status, setStatus] = useState<RenderStatus>({
    stage: "idle",
    progress: 0,
    message: "",
  });
  const timer = useRef<number | null>(null);

  const job = useCallback(
    () =>
      buildJob(
        spec,
        media,
        textOverrides,
        audio ? { name: audio.name, trimStart: audio.trimStart, volume: audio.volume } : null,
      ),
    [spec, media, textOverrides, audio],
  );

  const downloadJob = useCallback(() => {
    const blob = new Blob([JSON.stringify(job(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${spec.name.toLowerCase().replace(/\s+/g, "-")}-render.json`;
    a.click();
  }, [job, spec.name]);

  const start = useCallback(async () => {
    setOpen(true);
    setStatus({ stage: "preparing", progress: 3, message: "Preparing composition…" });
    const payload = job();
    payload.output.crf = QUALITIES.find((q) => q.key === quality)!.crf;

    try {
      // Pull every source clip out of the browser and ship it with the job so the
      // worker never depends on blob URLs it cannot see.
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
          message: `Uploading sources… ${done}/${entries.length}`,
        });
      }
      if (audio?.url) {
        const ab = await fetch(audio.url).then((r) => r.blob());
        form.append("audio", ab, audio.name || "audio");
      }
      form.append("job", JSON.stringify(payload));

      setStatus({ stage: "uploading", progress: 28, message: "Submitting render job…" });
      const res = await fetch("/api/public/render", { method: "POST", body: form });
      const data = (await res.json()) as {
        configured: boolean;
        jobId?: string;
        error?: string;
      };
      if (!data.configured) {
        setStatus({
          stage: "error",
          progress: 0,
          message:
            "No render worker is connected. Full-quality H.264 rendering runs on a Remotion worker (Chromium + ffmpeg) — start render-worker/server.mjs and set REMOTION_WORKER_URL. You can download the render job below in the meantime.",
        });
        return;
      }
      if (!res.ok || !data.jobId) throw new Error(data.error ?? "Render worker rejected the job");

      const jobId = data.jobId;
      setStatus({ stage: "rendering", progress: 30, message: "Rendering frames…" });
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
            message: "Render complete — H.264 MP4 ready",
            downloadUrl: s.url,
          });
          return;
        }
        if (s.state === "error") {
          setStatus({ stage: "error", progress: 0, message: s.error ?? "Render failed" });
          return;
        }
        setStatus({
          stage: "rendering",
          progress: 30 + Math.round((s.progress ?? 0) * 68),
          message: s.state === "queued" ? "Queued on the worker…" : "Rendering frames…",
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
              Export · {spec.width}×{spec.height} H.264
            </DialogTitle>
            <DialogDescription>
              {spec.duration.toFixed(1)}s · {spec.fps}fps · {spec.mediaSlots.length} shots ·{" "}
              {(spec.creativeEvents ?? []).length} creative moments
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
              {(status.stage === "preparing" ||
                status.stage === "uploading" ||
                status.stage === "rendering") && (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
              )}
              <span>
                {status.stage === "rendering" ? `${status.progress}% — ` : ""}
                {status.message}
              </span>
            </p>
            <div className="flex gap-2">
              {status.downloadUrl && (
                <Button asChild className="flex-1">
                  <a href={status.downloadUrl} download>
                    <Download className="size-4" /> Download MP4
                  </a>
                </Button>
              )}
              <Button variant="secondary" className="flex-1" onClick={downloadJob}>
                Download render job
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
