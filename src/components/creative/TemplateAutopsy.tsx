import { useMemo, useState } from "react";
import { Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TemplatePlayer } from "@/components/video/TemplatePlayer";
import { autopsy, type Strength } from "@/lib/creative/autopsy";
import { extractRegion, savePart, type PartKind } from "@/lib/creative/parts";
import type { AudioTrack, MediaMap, TemplateSpec } from "@/lib/template/types";

interface Props {
  spec: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
  audio?: AudioTrack | null;
}

const STRENGTH_TO_KIND: Record<Strength["kind"], PartKind> = {
  "Strong Opener": "opener",
  "Good Text Moment": "text_moment",
  "Interesting Product Reveal": "product_reveal",
  "Useful Graphic Event": "graphic_moment",
  "Strong Transition Sequence": "transition",
  "Strong Ending": "ending",
};

const PART_KINDS: PartKind[] = [
  "opener",
  "ending",
  "text_moment",
  "transition",
  "product_reveal",
  "interlude",
  "hero_sequence",
  "graphic_moment",
  "microcut_sequence",
  "recipe",
];

function fmt(t: number) {
  return `${t.toFixed(1)}s`;
}

export default function TemplateAutopsy({ spec, media, textOverrides, audio }: Props) {
  const report = useMemo(() => autopsy(spec), [spec]);

  const [regionStart, setRegionStart] = useState(0);
  const [regionEnd, setRegionEnd] = useState(Math.min(spec.duration, 1.5));
  const [regionKind, setRegionKind] = useState<PartKind>("interlude");
  const [regionName, setRegionName] = useState("");

  const harvestStrength = (s: Strength) => {
    const [start, end] = s.range;
    const fragment = extractRegion(spec, start, end);
    const part = savePart({
      name: `${s.kind} · ${spec.name}`,
      kind: STRENGTH_TO_KIND[s.kind],
      sourceSpecId: spec.id,
      range: [start, end],
      fragment,
      tags: [s.kind.toLowerCase().replace(/\s+/g, "_")],
    });
    toast.success(`Saved "${part.name}" to your parts library`);
  };

  const saveRegion = () => {
    const start = Math.min(regionStart, regionEnd);
    const end = Math.max(regionStart, regionEnd);
    if (end - start < 0.05) {
      toast.error("Region is too short");
      return;
    }
    const fragment = extractRegion(spec, start, end);
    const part = savePart({
      name: regionName.trim() || `${regionKind} · ${spec.name}`,
      kind: regionKind,
      sourceSpecId: spec.id,
      range: [start, end],
      fragment,
      tags: [regionKind],
    });
    toast.success(`Saved "${part.name}" (${fmt(end - start)})`);
    setRegionName("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Template Autopsy
        </h2>
        <p className="text-[11px] text-muted-foreground">
          {report.blueprint ? `Built on “${report.blueprint.name}”. ` : "No blueprint detected. "}
          {report.openingSummary} {report.endingSummary}
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Shot rhythm
        </h3>
        <div className="flex h-16 items-end gap-[2px] rounded-md border border-border bg-card/40 p-2">
          {report.rhythm.bars.map((b, i) => (
            <div
              key={i}
              title={`${fmt(b.start)} → ${fmt(b.start + b.duration)} (${b.duration.toFixed(2)}s)`}
              className={
                "flex-1 rounded-sm " +
                (b.kind === "microcut"
                  ? "bg-amber-400/80"
                  : b.kind === "hold"
                    ? "bg-sky-400/80"
                    : "bg-primary/60")
              }
              style={{ height: `${Math.max(8, b.height * 100)}%` }}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          mean {report.rhythm.mean}s · min {report.rhythm.min}s · max {report.rhythm.max}s ·{" "}
          {report.rhythm.microcutCount} microcuts · {report.rhythm.holdCount} holds
        </p>
      </section>

      {report.beatAlignment.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Beat alignment (±80ms)
          </h3>
          <ul className="space-y-1">
            {report.beatAlignment.map((b, i) => (
              <li key={i} className="text-[11px] text-muted-foreground">
                cut at {fmt(b.cutTime)} lands {b.deltaMs}ms from beat {fmt(b.beatTime)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Type systems
          </p>
          <p className="text-muted-foreground">{report.typeSystems.join(", ") || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Motion slots used
          </p>
          <p className="text-muted-foreground">{report.motionSlotsUsed.join(", ") || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Motion kit items
          </p>
          <p className="text-muted-foreground">{report.motionKitItems.length}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Creative events
          </p>
          <p className="text-muted-foreground">{report.creativeEvents.length}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Brand assets
          </p>
          <p className="text-muted-foreground">{report.brandAssets.length || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            End card
          </p>
          <p className="text-muted-foreground">{report.endCardId ?? "none"}</p>
        </div>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Copy placements
        </h3>
        <ul className="space-y-1">
          {report.copyPlacements.map((c) => (
            <li key={c.id} className="text-[11px] text-muted-foreground">
              {fmt(c.start)} · {c.style} · {c.position} — “{c.value}”
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Harvest creative parts
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {report.strengths.map((s, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-border">
              <div className="aspect-[4/5] bg-black">
                <TemplatePlayer
                  spec={spec}
                  media={media}
                  textOverrides={textOverrides}
                  audio={audio}
                  controls={false}
                  autoPlay={false}
                  loop={false}
                  clickToPlay={false}
                  initialFrame={Math.round(s.range[0] * spec.fps)}
                />
              </div>
              <div className="space-y-1 p-2">
                <p className="truncate text-[11px] font-semibold">{s.kind}</p>
                <p className="truncate text-[10px] text-muted-foreground">{s.reason}</p>
                <p className="text-[10px] text-muted-foreground">
                  {fmt(s.range[0])} → {fmt(s.range[1])} · score {s.score.toFixed(1)}
                </p>
                <Button size="sm" variant="secondary" className="w-full" onClick={() => harvestStrength(s)}>
                  <Sparkles className="size-3.5" /> Save as {STRENGTH_TO_KIND[s.kind]}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Save timeline region
        </h3>
        <p className="text-[11px] text-muted-foreground">
          {fmt(Math.min(regionStart, regionEnd))} → {fmt(Math.max(regionStart, regionEnd))}
        </p>
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground">Start</p>
          <Slider
            value={[regionStart]}
            min={0}
            max={spec.duration}
            step={0.05}
            onValueChange={([v]) => setRegionStart(v ?? 0)}
          />
          <p className="text-[10px] text-muted-foreground">End</p>
          <Slider
            value={[regionEnd]}
            min={0}
            max={spec.duration}
            step={0.05}
            onValueChange={([v]) => setRegionEnd(v ?? spec.duration)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={regionKind} onValueChange={(v) => setRegionKind(v as PartKind)}>
            <SelectTrigger className="h-8 flex-1 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PART_KINDS.map((k) => (
                <SelectItem key={k} value={k} className="text-[11px]">
                  {k.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          value={regionName}
          onChange={(e) => setRegionName(e.target.value)}
          placeholder="name this part"
        />
        <Button size="sm" className="w-full" onClick={saveRegion}>
          <Save className="size-3.5" /> Save region
        </Button>
      </section>
    </div>
  );
}
