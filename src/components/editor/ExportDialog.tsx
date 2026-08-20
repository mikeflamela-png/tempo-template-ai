import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileCode2,
  Info,
  Loader2,
  Package,
  ShieldAlert,
} from "lucide-react";
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
import { endCardById } from "@/lib/brand/endcards";
import { typeSystemsForBrand } from "@/lib/brand/typesystems";
import { motionAssetById } from "@/lib/motion/assets";
import { runPreflight, type PreflightIssue } from "@/lib/render/preflight";
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

const LEVEL_STYLE: Record<PreflightIssue["level"], string> = {
  block: "border-destructive/50 bg-destructive/10",
  warn: "border-amber-500/40 bg-amber-500/10",
  info: "border-border bg-muted/40",
};

function LevelIcon({ level }: { level: PreflightIssue["level"] }) {
  if (level === "block") return <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />;
  if (level === "warn") return <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />;
  return <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />;
}

function CopyableError({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-destructive">Worker error</p>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-foreground">
        {text}
      </pre>
    </div>
  );
}

export function ExportDialog({ spec, media, textOverrides, audio }: Props) {
  const store = useBrandStore();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("vertical");
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [status, setStatus] = useState<RenderStatus>({ stage: "idle", progress: 0, message: "" });
  const [ackWarnings, setAckWarnings] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const timer = useRef<number | null>(null);

  const brand = brandById(store.activeKitId);
  const copy = copyKitById(store.activeCopyId);

  const issues = useMemo<PreflightIssue[]>(() => {
    const typeSystems = brand ? typeSystemsForBrand(brand.id).filter((t) => spec.typeSystemIds?.includes(t.id)) : [];
    const motionAssets = (spec.motionAssets ?? [])
      .map((m) => motionAssetById(m.assetId))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
    const endCard = spec.endCardId ? endCardById(spec.endCardId) : null;
    const uploadBytes = 0; // computed after files are read at submit time; not known up front
    return runPreflight({
      spec,
      media,
      audio,
      brand,
      typeSystems,
      motionAssets,
      endCard,
      uploadBytes,
    });
  }, [spec, media, audio, brand]);

  const blockingIssues = issues.filter((i) => i.level === "block");
  const warnIssues = issues.filter((i) => i.level === "warn");
  const infoIssues = issues.filter((i) => i.level === "info");
  const canRender = blockingIssues.length === 0 && (warnIssues.length === 0 || ackWarnings);

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
    if (!canRender) return;
    setStatus({ stage: "preparing", progress: 3, message: "Preparing composition…" });
    setNotConfigured(false);
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
        setNotConfigured(true);
        setStatus({
          stage: "error",
          progress: 0,
          message: "No render service connected.",
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
  }, [canRender, job, media, audio, quality]);

  const active =
    status.stage === "preparing" ||
    status.stage === "uploading" ||
    status.stage === "queued" ||
    status.stage === "rendering" ||
    status.stage === "encoding";

  const fmt = EXPORT_FORMATS.find((f) => f.key === format)!;

  const handoff = () => (
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
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} className="font-semibold">
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

            {status.stage === "idle" && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Preflight {issues.length === 0 && "· all clear"}
                </p>
                {issues.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <Check className="size-3.5 text-emerald-400" /> Nothing to flag — ready to render.
                  </div>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {[...blockingIssues, ...warnIssues, ...infoIssues].map((issue, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 rounded-lg border p-2.5 text-xs ${LEVEL_STYLE[issue.level]}`}
                      >
                        <LevelIcon level={issue.level} />
                        <div>
                          <p className="font-semibold text-foreground">{issue.title}</p>
                          <p className="mt-0.5 text-muted-foreground">{issue.detail}</p>
                          {issue.fix && <p className="mt-1 text-muted-foreground/80">Fix: {issue.fix}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {warnIssues.length > 0 && blockingIssues.length === 0 && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={ackWarnings}
                      onChange={(e) => setAckWarnings(e.target.checked)}
                      className="size-3.5"
                    />
                    I understand these warnings and want to render anyway
                  </label>
                )}
              </div>
            )}

            {status.stage === "idle" ? (
              <Button className="w-full font-semibold" disabled={!canRender} onClick={() => void start()}>
                <Download className="size-4" />
                {blockingIssues.length > 0 ? "Fix blocking issues to render" : "Render MP4"}
              </Button>
            ) : (
              <>
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
                      {status.stage}
                    </span>{" "}
                    {status.stage === "rendering" ? `${status.progress}% — ` : ""}
                    {status.message}
                  </span>
                </p>
              </>
            )}

            {notConfigured && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <p className="font-semibold text-amber-200">Server rendering is not connected</p>
                <p className="mt-1 text-muted-foreground">
                  No render worker is configured for this project, so there is no service that can
                  turn this timeline into an actual MP4 file right now. Use the Final Cut XML or
                  handoff package below, or connect a render worker.
                </p>
                <Button asChild variant="secondary" size="sm" className="mt-2">
                  <Link to="/settings/rendering">Set up the render worker</Link>
                </Button>
              </div>
            )}

            {status.stage === "error" && !notConfigured && (
              <CopyableError text={status.message} />
            )}

            {status.downloadUrl && (
              <Button asChild className="w-full">
                <a href={status.downloadUrl} download>
                  <Download className="size-4" /> Download MP4
                </a>
              </Button>
            )}

            {handoff()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
