import { useCallback, useMemo, useState } from "react";
import { FlaskConical, Loader2, Save, Shuffle, Sparkles, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ExperimentPlayer } from "./ExperimentPlayer";
import {
  generateExperiments,
  type Experiment,
  type LabMode,
} from "@/lib/creative/invent";
import {
  allTechniques,
  saveRecipe,
  saveTechnique,
  tasteProfile,
  useCreativeLibrary,
  type Technique,
} from "@/lib/creative/registry";
import { KERNEL_BY_ID } from "@/lib/creative/kernels";
import { getReel } from "@/lib/template/store";
import { PLACEHOLDERS } from "@/lib/template/placeholders";
import { fontByKey } from "@/lib/template/fonts";
import type { MediaAssignment, Palette } from "@/lib/template/types";

const MODES: { key: LabMode; label: string; hint: string }[] = [
  { key: "invent", label: "Invent", hint: "New technique from a written brief" },
  { key: "mutate", label: "Mutate", hint: "Push an existing technique somewhere odd" },
  { key: "combine", label: "Combine", hint: "Layer two techniques into one moment" },
  { key: "reference", label: "Reference", hint: "Extract principles from a clip you describe" },
];

const PALETTE: Palette = { bg: "#0b0b0d", ink: "#f5f2ec", accent: "#e8ff54" };

export function previewFootage(): MediaAssignment | null {
  const reel = getReel();
  if (reel) {
    return {
      url: reel.url,
      kind: "video",
      name: reel.name,
      inPoint: Math.min(2, Math.max(0, reel.duration * 0.2)),
    };
  }
  const src = PLACEHOLDERS[1] ?? PLACEHOLDERS[0];
  return src ? { url: src, kind: "image", name: "placeholder" } : null;
}

function TechniqueSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const techniques = allTechniques();
  return (
    <label className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
      >
        {techniques.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.origin !== "builtin" ? " ★" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ExperimentCard({
  exp,
  onMutate,
}: {
  exp: Experiment;
  onMutate?: (t: Technique) => void;
}) {
  const footage = useMemo(previewFootage, []);
  const [saved, setSaved] = useState<Technique | null>(null);

  const save = () => {
    const first = exp.layers[0]!;
    const t = saveTechnique({
      name: exp.title,
      kernel: first.kernel,
      params: first.params,
      duration: exp.duration,
      tags: exp.tags,
      origin:
        exp.kind === "mutation" ? "mutation" : exp.kind === "composite" ? "combination" : "invented",
      note: exp.rationale,
    });
    if (exp.layers.length > 1) {
      const ids = exp.layers.slice(1).map((l, i) =>
        saveTechnique({
          name: `${exp.title} · layer ${i + 2}`,
          kernel: l.kernel,
          params: l.params,
          duration: l.duration,
          tags: exp.tags,
          origin: "combination",
          note: `Second layer of ${exp.title}`,
        }),
      );
      saveRecipe({
        name: exp.title,
        note: exp.rationale,
        steps: [
          { techniqueId: t.id, offset: 0, duration: exp.layers[0]!.duration },
          ...ids.map((x, i) => ({
            techniqueId: x.id,
            offset: exp.layers[i + 1]!.offset,
            duration: exp.layers[i + 1]!.duration,
          })),
        ],
        duration: exp.duration,
        origin: "combination",
      });
    }
    setSaved(t);
    toast.success(`Saved “${exp.title}” to the library`);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
      <div className="relative aspect-[4/5] w-full bg-black">
        <ExperimentPlayer
          layers={exp.layers}
          palette={PALETTE}
          fontStack={fontByKey("archivo-black").stack}
          footage={footage}
          word={exp.word ?? "NOW"}
          duration={Math.max(1.2, exp.duration + 0.4)}
          width={864}
          height={1080}
        />
        <span className="absolute left-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur">
          {exp.kind}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold">{exp.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{exp.rationale}</p>
        </div>
        <ul className="space-y-1">
          {exp.principles.map((p) => (
            <li key={p} className="text-[11px] text-muted-foreground">
              — {p}
            </li>
          ))}
        </ul>
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {exp.layers.map((l) => KERNEL_BY_ID[l.kernel]?.name ?? l.kernel).join(" + ")} ·{" "}
          {exp.duration.toFixed(2)}s
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={!!saved} className="flex-1">
            <Save className="size-3.5" /> {saved ? "Saved" : "Save technique"}
          </Button>
          {onMutate && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const t = saved ?? saveTechnique({
                  name: exp.title,
                  kernel: exp.layers[0]!.kernel,
                  params: exp.layers[0]!.params,
                  duration: exp.duration,
                  tags: exp.tags,
                  origin: "invented",
                  note: exp.rationale,
                });
                setSaved(t);
                onMutate(t);
              }}
            >
              <Shuffle className="size-3.5" /> Mutate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Workbench() {
  const lib = useCreativeLibrary();
  const [mode, setMode] = useState<LabMode>("invent");
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState("");
  const [wildness, setWildness] = useState(0.6);
  const [sourceId, setSourceId] = useState(lib.techniques[0]?.id ?? "");
  const [secondId, setSecondId] = useState(lib.techniques[1]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [experiments, setExperiments] = useState<Experiment[]>([]);

  const run = useCallback(() => {
    setBusy(true);
    setTimeout(() => {
      const source = lib.techniques.find((t) => t.id === sourceId) ?? null;
      const second = lib.techniques.find((t) => t.id === secondId) ?? null;
      const brief =
        mode === "reference"
          ? `${reference} ${prompt}`.trim() || "abrupt analog cutting, physical texture"
          : prompt || "an unexpected, physical moment that breaks the grid";
      setExperiments(
        generateExperiments({ prompt: brief, mode, source, second, count: 4, wildness }),
      );
      setBusy(false);
    }, 260);
  }, [mode, prompt, reference, sourceId, secondId, wildness, lib.techniques]);

  const taste = tasteProfile();

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              title={m.hint}
              className={`rounded-full px-3.5 py-1.5 text-xs uppercase tracking-widest transition-colors ${
                m.key === mode
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {MODES.find((m) => m.key === mode)!.hint}
        </p>

        {mode === "reference" && (
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Paste a reference link or describe the clip: 'fashion film, torn paper transitions, handheld, warm grain'"
            className="mt-4"
          />
        )}

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === "mutate"
              ? "How should it change? e.g. slower, wetter, let the edge tear further"
              : "e.g. a torn paper edge that rips the frame away and leaves a hand-drawn circle behind"
          }
          className="mt-3 min-h-24 resize-none"
        />

        {(mode === "mutate" || mode === "combine") && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TechniqueSelect value={sourceId} onChange={setSourceId} label="Source technique" />
            {mode === "combine" && (
              <TechniqueSelect value={secondId} onChange={setSecondId} label="Combine with" />
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-5">
          <div className="min-w-52 flex-1">
            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Wildness · {Math.round(wildness * 100)}%
            </p>
            <Slider
              value={[wildness]}
              onValueChange={([v]) => setWildness(v ?? 0.6)}
              min={0}
              max={1}
              step={0.05}
            />
          </div>
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
            Generate 4 experiments
          </Button>
        </div>

        {taste.length > 0 && (
          <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Sparkles className="size-3.5" /> Taste profile:{" "}
            {taste.map(([t]) => t).join(" · ")}
          </p>
        )}
      </div>

      {experiments.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {experiments.map((e) => (
            <ExperimentCard
              key={e.id}
              exp={e}
              onMutate={(t) => {
                setMode("mutate");
                setSourceId(t.id);
                toast.info(`Mutating “${t.name}” — adjust the brief and generate again`);
              }}
            />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <Layers className="mb-2 size-4" />
        Everything saved here enters the generator's technique pool immediately — new templates will
        start using your inventions, weighted by what you save and favourite.
      </div>
    </div>
  );
}
