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
  /** Optional: lets contextual commands retime shots/text inside the region. */
  onPatchSpec?: (patch: Partial<TemplateSpec>) => void;
}

/**
 * Contextual editing commands. Each one is a real, local operation: it seeds the
 * alternative generator with a specific creative intent AND optionally retimes
 * or thins the selected region only — the rest of the edit is untouched.
 */
type RegionOp = (spec: TemplateSpec, from: number, to: number) => Partial<TemplateSpec>;

const inRegion = (start: number, dur: number, from: number, to: number) =>
  start < to && start + dur > from;

const COMMANDS: { label: string; prompt: string; op?: RegionOp }[] = [
  { label: "Make this better", prompt: "one confident, well-timed accent — nothing decorative" },
  {
    label: "Cleaner",
    prompt: "restrained, one idea only, generous negative space",
    op: (sp, f, t) => ({
      creativeEvents: (sp.creativeEvents ?? []).filter((e) => !inRegion(e.start, e.duration, f, t)),
    }),
  },
  { label: "More filmic", prompt: "handheld weight, halation, film grain, soft exposure shift" },
  { label: "More editorial", prompt: "paper edge, printed caption, typographic restraint" },
  { label: "More social", prompt: "punchy hook energy, quick pops, a caption that lands fast" },
  { label: "Less AI-looking", prompt: "organic masks, hand-torn edges, off-grid placement, no clean rectangles" },
  { label: "Weirder", prompt: "an unexpected interruption — scribble, freeze, jump in scale" },
  { label: "Add a product moment", prompt: "isolate the product with a scale punch and a held beat" },
  { label: "Add a graphic moment", prompt: "a drawn badge, arrow or ticker over the footage" },
  {
    label: "Simplify this section",
    prompt: "strip it back to footage and one word",
    op: (sp, f, t) => ({
      creativeEvents: (sp.creativeEvents ?? []).filter((e) => !inRegion(e.start, e.duration, f, t)),
      graphicSlots: (sp.graphicSlots ?? []).filter((g) => !inRegion(g.start, g.duration, f, t)),
    }),
  },
  {
    label: "Hit the music",
    prompt: "cut exactly on the beat",
    op: (sp, f, t) => {
      const beats = sp.beatMarkers ?? [];
      if (!beats.length) return {};
      const snap = (v: number) =>
        beats.reduce((best, b) => (Math.abs(b - v) < Math.abs(best - v) ? b : best), v);
      return {
        mediaSlots: sp.mediaSlots.map((m) => {
          if (!inRegion(m.start, m.duration, f, t)) return m;
          const st = snap(m.start);
          const en = Math.max(st + 0.2, snap(m.start + m.duration));
          return { ...m, start: st, duration: en - st };
        }),
      };
    },
  },
  {
    label: "Stronger opening",
    prompt: "an immediate hit in the first quarter second",
    op: (sp) => ({
      mediaSlots: sp.mediaSlots.map((m, i) =>
        i === 0 ? { ...m, duration: Math.max(0.35, m.duration * 0.6) } : m,
      ),
    }),
  },
  {
    label: "Stronger ending",
    prompt: "a resolved final hold, the last word left on screen",
    op: (sp) => {
      const last = sp.mediaSlots[sp.mediaSlots.length - 1];
      if (!last) return {};
      return {
        mediaSlots: sp.mediaSlots.map((m) =>
          m.id === last.id ? { ...m, duration: m.duration + 0.4 } : m,
        ),
        duration: sp.duration + 0.4,
      };
    },
  },
  {
    label: "More breathing room",
    prompt: "let one shot hold longer, drop the clutter",
    op: (sp, f, t) => ({
      mediaSlots: sp.mediaSlots.map((m) =>
        inRegion(m.start, m.duration, f, t) ? { ...m, duration: m.duration * 1.25 } : m,
      ),
      duration: sp.duration + 0.3,
    }),
  },
];

export function MomentEditor({ spec, media, playhead, onChange, onPatchSpec }: Props) {
  const [command, setCommand] = useState<string | null>(null);
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

  const runCommand = (label: string) => {
    const cmd = COMMANDS.find((c) => c.label === label);
    if (!cmd) return;
    setCommand(label);
    setPrompt(cmd.prompt);
    setBusy(true);
    if (cmd.op && onPatchSpec) onPatchSpec(cmd.op(spec, start, start + length));
    setTimeout(() => {
      setAlts(momentAlternatives({ prompt: cmd.prompt, duration: length, count: 4 }));
      setBusy(false);
    }, 200);
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
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {COMMANDS.map((c) => (
            <button
              key={c.label}
              onClick={() => runCommand(c.label)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                command === c.label
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
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
