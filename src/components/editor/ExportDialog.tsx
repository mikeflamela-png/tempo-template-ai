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
import { renderStatus, submitRender } from "@/lib/render/render.functions";
import type { AudioTrack, MediaMap, TemplateSpec } from "@/lib/template/types";

interface Props {
  spec: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
  audio: AudioTrack | null;
}

export function ExportDialog({ spec, media, textOverrides, audio }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RenderStatus>({
    stage: "idle",
    progress: 0,
    message: "",
  });
  const timer = useRef<number | null>(null);

  const downloadJob = useCallback(() => {
    const job = buildJob(
      spec,
      media,
      textOverrides,
      audio ? { name: audio.name, trimStart: audio.trimStart, volume: audio.volume } : null,
    );
    const blob = new Blob([JSON.stringify(job, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${spec.name.toLowerCase().replace(/\s+/g, "-")}-render.json`;
    a.click();
  }, [spec, media, textOverrides, audio]);

  const start = useCallback(async () => {
    setOpen(true);
    setStatus({ stage: "preparing", progress: 4, message: "Preparing composition…" });
    const job = buildJob(
      spec,
      media,
      textOverrides,
      audio ? { name: audio.name, trimStart: audio.trimStart, volume: audio.volume } : null,
    );
    try {
      const res = await submitRender({ data: { payload: job } });
      if (!res.configured) {
        setStatus({
          stage: "error",
          progress: 0,
          message:
            "No render worker is connected yet. Full-quality H.264 rendering needs a Remotion worker (Chromium + ffmpeg) — the app's edge runtime can't run it. You can download the render job below and run it on a worker.",
        });
        return;
      }
      const jobId = res.jobId;
      setStatus({ stage: "rendering", progress: 8, message: "Rendering frames…" });
      const poll = async () => {
        const s = await renderStatus({ data: { jobId } });
        if (!s.configured) return;
        if (s.state === "done" && s.url) {
          setStatus({
            stage: "done",
            progress: 100,
            message: "Render complete",
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
          progress: Math.round((s.progress ?? 0) * 100),
          message: s.state === "queued" ? "Queued…" : "Rendering frames…",
        });
        timer.current = window.setTimeout(poll, 1200);
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
  }, [spec, media, textOverrides, audio]);

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
            <DialogTitle>Export · {spec.width}×{spec.height} H.264</DialogTitle>
            <DialogDescription>
              {spec.duration.toFixed(1)}s · {spec.fps}fps · {spec.mediaSlots.length} shots
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${status.stage === "error" ? 0 : status.progress}%` }}
              />
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              {(status.stage === "preparing" || status.stage === "rendering") && (
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
