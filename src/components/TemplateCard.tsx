import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PlayerRef } from "@remotion/player";
import {
  Bookmark,
  BookmarkCheck,
  Heart,
  Play,
  Shuffle,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { TemplatePlayer } from "@/components/video/TemplatePlayer";
import { Button } from "@/components/ui/button";
import type { TemplateSpec } from "@/lib/template/types";
import { toggleSaved, useTemplateStore } from "@/lib/template/store";
import { reelMediaFor, reelSegments } from "@/lib/template/reel";
import { fontByKey } from "@/lib/template/fonts";
import { recordFeedback } from "@/lib/taste/profile";
import { useRecipeStore } from "@/lib/recipe/store";

export function TemplateCard({
  spec,
  onRegenerate,
  onRemix,
}: {
  spec: TemplateSpec;
  onRegenerate?: (spec: TemplateSpec) => void;
  onRemix?: (spec: TemplateSpec) => void;
}) {
  const ref = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(false);
  const [dna, setDna] = useState(false);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [feedback, setFeedback] = useState<"love" | "good" | "bad" | null>(null);
  const { saved, reel } = useTemplateStore();
  const isSaved = saved.includes(spec.id);
  const { recipe } = useRecipeStore();
  const constraints = useMemo(
    () => ({ regions: recipe.footage.value.regions }),
    [recipe.footage.value.regions],
  );
  const media = useMemo(
    () => reelMediaFor(spec, reel, 0, constraints),
    [spec, reel, constraints],
  );
  const segments = useMemo(
    () => (reel ? reelSegments(spec, reel, 0, constraints).slice(0, 4) : []),
    [spec, reel, constraints],
  );
  const font = fontByKey(spec.fontKey);
  const d = spec.direction;
  const description = d?.creativeIdea ?? spec.creativeProfile.family;

  const toggle = () => {
    const p = ref.current;
    if (!p) return;
    if (p.isPlaying()) {
      p.pause();
      setPlaying(false);
    } else {
      p.play();
      setPlaying(true);
    }
  };

  const love = () => {
    setFeedback("love");
    setReasonsOpen(false);
    recordFeedback({ targetId: spec.id, kind: "love", tags: [] });
  };

  const good = () => {
    setFeedback("good");
    setReasonsOpen(false);
    recordFeedback({ targetId: spec.id, kind: "love", tags: ["good"] });
  };

  const bad = () => {
    setFeedback("bad");
    setReasonsOpen((v) => !v);
  };

  const pickReason = (tag: string) => {
    recordFeedback({ targetId: spec.id, kind: "dislike", tags: [tag] });
    setReasonsOpen(false);
  };

  return (
    <div className="group flex flex-col gap-4">
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-black shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]"
        style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
      >
        <TemplatePlayer
          ref={ref}
          spec={spec}
          media={media}
          textOverrides={{}}
          controls={false}
          loop
          clickToPlay={false}
          initialFrame={Math.round(spec.duration * spec.fps * 0.35)}
        />
        <button
          onClick={toggle}
          aria-label={playing ? "Pause preview" : "Play preview"}
          className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 data-[idle=true]:opacity-100"
          data-idle={!playing}
        >
          {!playing && (
            <span className="flex size-16 items-center justify-center rounded-full bg-background/85 backdrop-blur">
              <Play className="size-6 translate-x-0.5 fill-foreground" />
            </span>
          )}
        </button>
        <button
          onClick={() => toggleSaved(spec.id)}
          aria-label="Save template"
          className="absolute right-3 top-3 rounded-full bg-background/70 p-2 backdrop-blur transition-colors hover:bg-background"
        >
          {isSaved ? (
            <BookmarkCheck className="size-4 text-primary" />
          ) : (
            <Bookmark className="size-4" />
          )}
        </button>
      </div>

      <div className="space-y-1">
        <h3 className="display-tight text-xl">{spec.name}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground/80">{description}</p>
      </div>

      <div className="flex gap-2">
        <Button asChild className="flex-1 font-semibold">
          <Link to="/editor/$id" params={{ id: spec.id }}>
            Use This
          </Link>
        </Button>
        {onRegenerate && (
          <Button
            variant="secondary"
            size="icon"
            onClick={() => onRegenerate(spec)}
            aria-label="Make another like this"
            title="Make another like this"
          >
            <Shuffle className="size-4" />
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setDna((v) => !v)}>
          Details
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={love}
          aria-label="Love this"
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            feedback === "love"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className="mr-1 inline size-3.5" /> Love
        </button>
        <button
          onClick={good}
          aria-label="Good"
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            feedback === "good"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <ThumbsUp className="mr-1 inline size-3.5" /> Good
        </button>
        <button
          onClick={bad}
          aria-label="Bad"
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            feedback === "bad"
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <ThumbsDown className="mr-1 inline size-3.5" /> Bad
        </button>
      </div>

      {reasonsOpen && (
        <div className="animate-fade-in flex flex-wrap gap-1.5 rounded-xl border border-border bg-card/60 p-3">
          {[
            "Too Busy",
            "Too Boring",
            "Too AI-looking",
            "Too Geometric",
            "Bad Typography",
            "Bad Motion",
            "Not On Brand",
          ].map((tag) => (
              <button
                key={tag}
                onClick={() => pickReason(tag)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                {tag}
              </button>
            ))}
        </div>
      )}

      {dna && (
        <div className="animate-fade-in space-y-3 rounded-xl border border-border bg-card/60 p-4 text-xs">
          {d ? (
            <>
              <Row k="Concept" v={`${d.conceptName} — ${d.creativeIdea}`} />
              <Row k="Pacing" v={d.pacingStrategy} />
              <Row k="Typography" v={`${font.name} (${font.category}) · ${d.typographyMotif.split(" · ")[1] ?? ""}`} />
              <Row k="Transitions" v={d.transitionMotif} />
              <Row k="Layouts" v={d.layoutMotif} />
              <Row k="Effects" v={d.textureKeys.join(", ") || "none"} />
              <Row k="Structure" v={`${d.openingStrategy} → ${d.middleStrategy} → ${d.endingStrategy}`} />
              <Row k="Surprise" v={d.surpriseMoment} />
              <Row k="Restraint" v={d.restraintRules.join(" · ")} />
            </>
          ) : (
            <>
              <Row k="Concept" v={spec.creativeProfile.family} />
              <Row k="Pacing" v={spec.creativeProfile.pacing} />
              <Row k="Typography" v={font.name} />
              <Row k="Transitions" v={spec.creativeProfile.transitionStyle} />
              <Row k="Structure" v={spec.creativeProfile.structure} />
            </>
          )}
          <Row
            k="Slots"
            v={`${spec.duration}s · ${spec.mediaSlots.length} media · ${spec.textSlots.length} text`}
          />
          {segments.length > 0 && (
            <Row
              k="Reel sections"
              v={segments.map((s) => `${s.from.toFixed(1)}–${s.to.toFixed(1)}s`).join(" · ")}
            />
          )}
          {onRemix && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => onRemix(spec)}>
                <Shuffle className="size-3.5" /> Remix
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{k}</span>
      <span className="text-foreground/90">{v}</span>
    </div>
  );
}
