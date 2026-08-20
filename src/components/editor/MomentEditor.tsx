import { useMemo, useState } from "react";
import { Wand2, Loader2, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ExperimentPlayer } from "@/components/creative/ExperimentPlayer";
import { momentAlternatives, type Experiment } from "@/lib/creative/invent";
import { KERNEL_BY_ID } from "@/lib/creative/kernels";
import { fontByKey } from "@/lib/template/fonts";
import type { CreativeEvent, MediaMap, TemplateSpec } from "@/lib/template/types";

interface Props {
  spec: TemplateSpec;
  media: MediaMap;
  playhead: number;
  onChange: (events: CreativeEvent[]) => void;
}

export function MomentEditor({ spec, media, playhead, onChange }: Props) {
  const [prompt, setPrompt] = useState("");
  const [length, setLength] = useState(1.2);
  const [busy, setBusy] = useState(false);
  const [alts, setAlts] = useState<Experiment[]>([]);

  const start = Math.max(0, Math.min(playhead, Math.max(0, spec.duration - length)));
  const events = spec.creativeEvents ?? [];

  const footage = useMemo(() => {
    const slot =
      spec.mediaSlots.find((s) => s.start <= start && s.start + s.duration > start) ??
      spec.mediaSlots[0];
    return slot ? media[slot.id] ?? null : null;
  }, [spec.mediaSlots, media, start]);

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      setAlts(
        momentAlternatives({
          prompt: prompt || `${spec.direction?.visualMotif ?? "a physical, off-grid moment"}`,
          duration: length,
          count: 4,
        }),
      );
      setBusy(false);
    }, 220);
  };

  const apply = (exp: Experiment) => {
    const added: CreativeEvent[] = exp.layers.map((l, i) => ({
      id: `ce-user-${Date.now().toString(36)}-${i}`,
      kernel: l.kernel,
      label: `${exp.title}${exp.layers.length > 1 ? ` · ${i + 1}` : ""}`,
      start: Math.min(spec.duration - 0.2, start + l.offset),
      duration: Math.max(0.25, l.duration),
      params: l.params,
      layer: KERNEL_BY_ID[l.kernel]?.role === "treatment" ? "under_text" : "over_all",
      ...(exp.word ? { word: exp.word } : {}),
      seed: 21 + i,
    }));
    onChange([...events, ...added]);
    toast.success(`“${exp.title}” applied at ${start.toFixed(1)}s`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Edit this moment
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Region {start.toFixed(1)}s → {(start + length).toFixed(1)}s (from the playhead)
        </p>
        <div className="mt-2">
          <Slider
            value={[length]}
            min={0.3}
            max={3}
            step={0.1}
            onValueChange={([v]) => setLength(v ?? 1.2)}
          />
        </div>
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="what should happen here?"
          className="mt-2"
        />
        <Button size="sm" className="mt-2 w-full" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          Generate 4 alternatives
        </Button>
      </div>

      {alts.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {alts.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-lg border border-border">
              <div className="aspect-[4/5] bg-black">
                <ExperimentPlayer
                  layers={a.layers}
                  palette={spec.palette}
                  fontStack={fontByKey(spec.fontKey).stack}
                  footage={footage}
                  word={a.word ?? spec.textSlots[0]?.value ?? "NOW"}
                  duration={length + 0.3}
                  width={640}
                  height={800}
                />
              </div>
              <div className="space-y-1.5 p-2">
                <p className="truncate text-[11px] font-semibold">{a.title}</p>
                <Button size="sm" variant="secondary" className="w-full" onClick={() => apply(a)}>
                  <Check className="size-3.5" /> Apply
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Creative moments
          </h3>
          <ul className="space-y-1.5">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-[11px]"
              >
                <span className="flex-1 truncate">
                  {e.label ?? KERNEL_BY_ID[e.kernel]?.name ?? e.kernel}
                </span>
                <span className="text-muted-foreground">{e.start.toFixed(1)}s</span>
                <button
                  onClick={() => onChange(events.filter((x) => x.id !== e.id))}
                  aria-label="Remove moment"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {spec.editPlan && (
        <div className="rounded-lg border border-dashed border-border p-2.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Critic · {spec.editPlan.criticScore}/10 · geometry{" "}
            {Math.round(spec.editPlan.geometryRatio * 100)}%
          </p>
          <ul className="mt-1.5 space-y-1">
            {spec.editPlan.criticNotes.map((nte) => (
              <li key={nte} className="text-[11px] leading-relaxed text-muted-foreground">
                — {nte}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
