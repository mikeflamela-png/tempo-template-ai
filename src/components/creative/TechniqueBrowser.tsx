import { useMemo, useState } from "react";
import { Heart, Shuffle, Save, Trash2, Sliders } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExperimentPlayer } from "./ExperimentPlayer";
import { previewFootage } from "./Workbench";
import { KERNEL_BY_ID, randomizeParams, type Params } from "@/lib/creative/kernels";
import {
  deleteRecipe,
  deleteTechnique,
  saveTechnique,
  toggleFavoriteTechnique,
  useCreativeLibrary,
  type Technique,
} from "@/lib/creative/registry";
import { fontByKey } from "@/lib/template/fonts";
import type { Palette } from "@/lib/template/types";

const PALETTE: Palette = { bg: "#0b0b0d", ink: "#f5f2ec", accent: "#e8ff54" };

function Preview({
  layers,
  duration,
  word = "TEMPO",
}: {
  layers: { kernel: string; params: Params; offset: number; duration: number }[];
  duration: number;
  word?: string;
}) {
  const footage = useMemo(previewFootage, []);
  return (
    <ExperimentPlayer
      layers={layers}
      palette={PALETTE}
      fontStack={fontByKey("archivo-black").stack}
      footage={footage}
      word={word}
      duration={Math.max(1.2, duration + 0.4)}
      width={864}
      height={1080}
    />
  );
}

function Playground({ technique, onClose }: { technique: Technique; onClose: () => void }) {
  const kernel = KERNEL_BY_ID[technique.kernel];
  const [params, setParams] = useState<Params>({ ...technique.params });
  const [duration, setDuration] = useState(technique.duration);
  if (!kernel) return null;

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{technique.name} · playground</DialogTitle>
        <DialogDescription>{kernel.blurb}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-5 sm:grid-cols-[240px_1fr]">
        <div className="aspect-[4/5] overflow-hidden rounded-xl bg-black">
          <Preview
            layers={[{ kernel: technique.kernel, params, offset: 0, duration }]}
            duration={duration}
          />
        </div>
        <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Duration · {duration.toFixed(2)}s
            </p>
            <Slider
              value={[duration]}
              min={0.25}
              max={4}
              step={0.05}
              onValueChange={([v]) => setDuration(v ?? duration)}
            />
          </div>
          {kernel.params.map((p) => (
            <div key={p.key}>
              <p className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {p.label}
                {p.type === "number" && ` · ${Number(params[p.key] ?? 0).toFixed(2)}`}
              </p>
              {p.type === "number" && (
                <Slider
                  value={[Number(params[p.key] ?? p.default)]}
                  min={p.min ?? 0}
                  max={p.max ?? 1}
                  step={p.step ?? 0.01}
                  onValueChange={([v]) => setParams((s) => ({ ...s, [p.key]: v ?? 0 }))}
                />
              )}
              {p.type === "choice" && (
                <div className="flex flex-wrap gap-1.5">
                  {p.choices!.map((c) => (
                    <button
                      key={c}
                      onClick={() => setParams((s) => ({ ...s, [p.key]: c }))}
                      className={`rounded-full px-2.5 py-1 text-[11px] ${
                        params[p.key] === c
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              {p.type === "color" && (
                <input
                  type="color"
                  value={String(params[p.key] ?? p.default)}
                  onChange={(e) => setParams((s) => ({ ...s, [p.key]: e.target.value }))}
                  className="h-8 w-16 rounded border border-border bg-transparent"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => setParams(randomizeParams(technique.kernel, Math.random))}
        >
          <Shuffle className="size-4" /> Randomise
        </Button>
        <Button
          onClick={() => {
            saveTechnique({
              name: `${technique.name} variant`,
              kernel: technique.kernel,
              params,
              duration,
              tags: technique.tags,
              origin: "mutation",
              note: `Hand-tuned variant of ${technique.name}`,
              parents: [technique.id],
            });
            toast.success("Variant saved to the library");
            onClose();
          }}
        >
          <Save className="size-4" /> Save as new technique
        </Button>
      </div>
    </DialogContent>
  );
}

export function TechniqueBrowser() {
  const { techniques } = useCreativeLibrary();
  const [open, setOpen] = useState<Technique | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const families = ["all", ...new Set(techniques.map((t) => KERNEL_BY_ID[t.kernel]?.family ?? "other"))];
  const list = techniques.filter(
    (t) => filter === "all" || KERNEL_BY_ID[t.kernel]?.family === filter,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {families.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-widest ${
              f === filter ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((t) => (
          <div key={t.id} className="overflow-hidden rounded-2xl border border-border bg-card/50">
            <div className="aspect-[4/5] bg-black">
              <Preview
                layers={[{ kernel: t.kernel, params: t.params, offset: 0, duration: t.duration }]}
                duration={t.duration}
              />
            </div>
            <div className="space-y-2 p-3">
              <p className="truncate text-sm font-semibold">{t.name}</p>
              <p className="line-clamp-2 text-[11px] text-muted-foreground">{t.note}</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {t.origin} · {t.duration.toFixed(2)}s · {t.uses} uses
              </p>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setOpen(t)}>
                  <Sliders className="size-3.5" /> Tune
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => toggleFavoriteTechnique(t.id)}
                  aria-label="Favourite"
                >
                  <Heart className={`size-4 ${t.favorite ? "fill-current text-primary" : ""}`} />
                </Button>
                {t.origin !== "builtin" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteTechnique(t.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        {open && <Playground technique={open} onClose={() => setOpen(null)} />}
      </Dialog>
    </div>
  );
}

export function RecipeBrowser() {
  const { recipes, techniques } = useCreativeLibrary();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((r) => {
        const layers = r.steps
          .map((s) => {
            const t = techniques.find((x) => x.id === s.techniqueId);
            if (!t) return null;
            return {
              kernel: t.kernel,
              params: t.params,
              offset: s.offset,
              duration: s.duration ?? t.duration,
            };
          })
          .filter(Boolean) as { kernel: string; params: Params; offset: number; duration: number }[];
        return (
          <div key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card/50">
            <div className="aspect-[4/5] bg-black">
              <Preview layers={layers} duration={r.duration} />
            </div>
            <div className="space-y-2 p-3">
              <p className="text-sm font-semibold">{r.name}</p>
              <p className="text-[11px] text-muted-foreground">{r.note}</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {r.steps.length} steps · {r.duration.toFixed(1)}s
              </p>
              {r.origin !== "builtin" && (
                <Button size="sm" variant="ghost" onClick={() => deleteRecipe(r.id)}>
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
