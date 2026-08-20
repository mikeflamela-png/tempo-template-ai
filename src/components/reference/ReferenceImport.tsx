"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { analyzeReferenceVideo, type ReferenceAnalysis } from "@/lib/reference/analyze";
import { analysisToBlueprint } from "@/lib/reference/toBlueprint";
import { cn } from "@/lib/utils";

function fmt(t: number) {
  return `${t.toFixed(1)}s`;
}

function Sparkline({ points }: { points: { t: number; cutsPerSecond: number }[] }) {
  if (!points.length) return null;
  const max = Math.max(0.5, ...points.map((p) => p.cutsPerSecond));
  return (
    <div className="flex h-12 items-end gap-px overflow-hidden rounded-md border border-border/60 bg-muted/30 p-1">
      {points.map((p, i) => (
        <div
          key={i}
          className="min-w-[2px] flex-1 rounded-sm bg-primary/70"
          style={{ height: `${Math.max(4, (p.cutsPerSecond / max) * 100)}%` }}
          title={`${fmt(p.t)} · ${p.cutsPerSecond}/s`}
        />
      ))}
    </div>
  );
}

function StructureBlock({
  title,
  cutCount,
  avgShotLength,
  events,
}: {
  title: string;
  cutCount: number;
  avgShotLength: number;
  events: { type: string; note: string }[];
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm text-foreground">
        {cutCount} cuts · avg shot {avgShotLength.toFixed(2)}s
      </p>
      {events.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {events.slice(0, 6).map((e, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] font-normal">
              {e.note}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReferenceImport() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<ReferenceAnalysis | null>(null);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function runAnalysis(f: File) {
    setBusy(true);
    setAnalysis(null);
    setProgress(0);
    setProgressLabel("Starting…");
    try {
      const result = await analyzeReferenceVideo(f, (pct, label) => {
        setProgress(pct);
        setProgressLabel(label);
      });
      setAnalysis(result);
      setName(`Reference: ${f.name.replace(/\.[^/.]+$/, "")}`);
      toast.success("Reference autopsy complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not analyze this video");
    } finally {
      setBusy(false);
    }
  }

  function handleFile(f: File | null) {
    setFile(f);
    if (f) runAnalysis(f);
  }

  function handleCreateBlueprint() {
    if (!analysis) return;
    try {
      const created = analysisToBlueprint(analysis, name);
      toast.success(`Blueprint "${created.name}" saved`, {
        description: `${created.blocks.length} blocks · ${created.motionSlots?.length ?? 0} motion slots`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save blueprint");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Reference Edit → Autopsy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a reference cut. Tempo samples it frame-by-frame to find its cuts, pacing, and
            creative events, then turns that structure into a reusable blueprint.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              ref={inputRef}
              type="file"
              accept="video/*"
              disabled={busy}
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="max-w-sm"
            />
            {file && !busy && (
              <span className="text-xs text-muted-foreground">{file.name}</span>
            )}
          </div>

          {busy && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{progressLabel}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {analysis && (
        <Card className={cn("border-border/60 bg-card/50")}>
          <CardHeader>
            <CardTitle className="text-base">Autopsy Report — {analysis.fileName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {fmt(analysis.duration)} total · {analysis.cuts.length} cuts detected ·{" "}
              {analysis.shots.length} shots
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pacing curve (cuts / second)
              </p>
              <Sparkline points={analysis.pacingCurve} />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-card/40 p-2 text-center">
                <p className="text-lg font-semibold text-foreground">{analysis.shotLengthBuckets.microcut}</p>
                <p className="text-[11px] text-muted-foreground">microcuts (&lt;0.4s)</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/40 p-2 text-center">
                <p className="text-lg font-semibold text-foreground">{analysis.shotLengthBuckets.fast}</p>
                <p className="text-[11px] text-muted-foreground">fast (0.4–1s)</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/40 p-2 text-center">
                <p className="text-lg font-semibold text-foreground">{analysis.shotLengthBuckets.medium}</p>
                <p className="text-[11px] text-muted-foreground">medium (1–2.5s)</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/40 p-2 text-center">
                <p className="text-lg font-semibold text-foreground">{analysis.shotLengthBuckets.hold}</p>
                <p className="text-[11px] text-muted-foreground">holds (&gt;2.5s)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <StructureBlock
                title="Opening"
                cutCount={analysis.opening.cutCount}
                avgShotLength={analysis.opening.avgShotLength}
                events={analysis.opening.events}
              />
              <StructureBlock
                title="Middle"
                cutCount={analysis.middle.cutCount}
                avgShotLength={analysis.middle.avgShotLength}
                events={analysis.middle.events}
              />
              <StructureBlock
                title="Ending"
                cutCount={analysis.ending.cutCount}
                avgShotLength={analysis.ending.avgShotLength}
                events={analysis.ending.events}
              />
            </div>

            {analysis.visualEvents.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Creative events detected
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.visualEvents.map((e, i) => (
                    <Badge key={i} variant="outline" className="text-[11px] font-normal">
                      {fmt(e.start)} · {e.note}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3 border-t border-border/60 pt-3">
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label htmlFor="blueprint-name" className="text-xs text-muted-foreground">
                  Blueprint name
                </Label>
                <Input
                  id="blueprint-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Reference blueprint name"
                />
              </div>
              <Button onClick={handleCreateBlueprint} disabled={busy}>
                Create Blueprint
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
