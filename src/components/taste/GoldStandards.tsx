/**
 * GOLD STANDARDS PANEL
 *
 * Upload reference videos ("this is what good looks like"), watch them get
 * analysed for pacing/motion/texture signals, tag what you like about each
 * one, and tune how much gold standards vs. accumulated taste feedback
 * should steer generation.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LIKE_TAGS,
  addGoldStandard,
  deleteGoldStandard,
  updateGoldStandard,
  useGoldStandards,
  type GoldSignals,
  type LikeTag,
} from "@/lib/taste/goldStandards";
import { setGoldInfluence, setTasteInfluence, tasteWeights, useTasteProfile } from "@/lib/taste/profile";

function SignalBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{pct}</span>
    </div>
  );
}

function signalBars(s: GoldSignals) {
  return [
    { label: "Pacing (fast)", value: Math.max(0, 1 - s.shotDurationMedian / 3) },
    { label: "Cut frequency", value: Math.min(1, s.cutFrequency / 3) },
    { label: "Micro-cuts", value: s.microcutRatio },
    { label: "Holds", value: s.holdRatio },
    { label: "Effect density", value: s.effectDensityProxy },
    { label: "Text frequency", value: s.textFrequencyProxy },
    { label: "Motion amount", value: s.motionAmount },
    { label: "Film texture", value: s.filmTextureAmount },
  ];
}

export default function GoldStandards() {
  const { items } = useGoldStandards();
  const { goldInfluence, tasteInfluence, feedback } = useTasteProfile();
  const [progress, setProgress] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("video/")) continue;
      const tempId = `pending-${file.name}-${Date.now()}`;
      setProgress((p) => ({ ...p, [tempId]: 0 }));
      try {
        await addGoldStandard(file, (pct) => setProgress((p) => ({ ...p, [tempId]: pct })));
      } finally {
        setProgress((p) => {
          const next = { ...p };
          delete next[tempId];
          return next;
        });
      }
    }
  }

  const weights = tasteWeights();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Gold standards</h3>
          <Button size="sm" onClick={() => inputRef.current?.click()}>
            Upload reference video
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Videos you admire. Each one is sampled locally to learn pacing, motion and texture — no upload leaves your device.
        </p>
      </div>

      {Object.keys(progress).length > 0 && (
        <div className="flex flex-col gap-2">
          {Object.entries(progress).map(([id, pct]) => (
            <div key={id} className="flex items-center gap-2">
              <Progress value={pct} className="h-1.5 flex-1" />
              <span className="w-9 shrink-0 text-right text-[11px] text-muted-foreground">{pct}%</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {items.length === 0 && (
          <p className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            No gold standards yet. Upload a video that nails the feel you want.
          </p>
        )}
        {items.map((g) => (
          <div key={g.id} className="rounded-lg border border-border/60 bg-card/50 p-3">
            <div className="flex items-start gap-3">
              {g.url && (
                <video src={g.url} className="h-16 w-28 shrink-0 rounded-md bg-black object-cover" muted />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={g.name}
                    onChange={(e) => updateGoldStandard(g.id, { name: e.target.value })}
                    className="h-7 w-48 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteGoldStandard(g.id)}
                  >
                    Remove
                  </Button>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{g.fileName}</p>

                <div className="mt-2 flex flex-wrap gap-1">
                  {LIKE_TAGS.map((tag) => {
                    const active = g.likes.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          updateGoldStandard(g.id, {
                            likes: active
                              ? g.likes.filter((t) => t !== tag)
                              : [...g.likes, tag as LikeTag],
                          })
                        }
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] capitalize transition-colors",
                          active
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border text-muted-foreground hover:border-foreground/40",
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>

                <Textarea
                  placeholder="What do you like about this one?"
                  value={g.notes}
                  onChange={(e) => updateGoldStandard(g.id, { notes: e.target.value })}
                  rows={2}
                  className="mt-2 text-xs"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-1 border-t border-border/40 pt-2 sm:grid-cols-2 sm:gap-x-4">
              {signalBars(g.signals).map((b) => (
                <SignalBar key={b.label} label={b.label} value={b.value} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/50 p-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium">Gold standard influence</span>
            <span className="tabular-nums text-muted-foreground">{Math.round(goldInfluence * 100)}%</span>
          </div>
          <Slider
            value={[goldInfluence]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([v]) => setGoldInfluence(v ?? goldInfluence)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            How strongly your reference videos' pacing and texture pull the generator.
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium">Taste influence</span>
            <span className="tabular-nums text-muted-foreground">{Math.round(tasteInfluence * 100)}%</span>
          </div>
          <Slider
            value={[tasteInfluence]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([v]) => setTasteInfluence(v ?? tasteInfluence)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Blend of taste-aligned ranking vs. exploration (defaults to ~75/25).
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-card/50 p-3">
        <h4 className="mb-2 text-xs font-medium">Current taste profile</h4>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-4">
          <SignalBar label="Pacing" value={weights.pacing} />
          <SignalBar label="Typography density" value={weights.typographyDensity} />
          <SignalBar label="Effect density" value={weights.effectDensity} />
          <SignalBar label="Transitions" value={weights.transitionFrequency} />
          <SignalBar label="Motion amount" value={weights.motionAmount} />
          <SignalBar label="Film texture" value={weights.filmTexture} />
          <SignalBar label="Restraint" value={weights.restraint} />
          <SignalBar label="Product focus" value={weights.productFocus} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Built from {items.length} gold standard{items.length === 1 ? "" : "s"} and {feedback.length} piece
          {feedback.length === 1 ? "" : "s"} of feedback.
        </p>
        {feedback.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {feedback.slice(0, 12).map((f) => (
              <Badge key={f.id} variant={f.kind === "love" ? "default" : "destructive"} className="text-[10px]">
                {f.tags[0] ?? (f.kind === "love" ? "loved" : "disliked")}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
