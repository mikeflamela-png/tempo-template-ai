import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PlayerRef } from "@remotion/player";
import { Bookmark, BookmarkCheck, Dna, Play, Shuffle, Sparkles } from "lucide-react";
import { TemplatePlayer } from "@/components/video/TemplatePlayer";
import { Button } from "@/components/ui/button";
import type { TemplateSpec } from "@/lib/template/types";
import { toggleSaved, useTemplateStore } from "@/lib/template/store";
import { reelMediaFor, reelSegments } from "@/lib/template/reel";
import { fontByKey } from "@/lib/template/fonts";

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
  const { saved, reel } = useTemplateStore();
  const isSaved = saved.includes(spec.id);
  const media = useMemo(() => reelMediaFor(spec, reel), [spec, reel]);
  const segments = useMemo(() => (reel ? reelSegments(spec, reel).slice(0, 4) : []), [spec, reel]);
  const font = fontByKey(spec.fontKey);
  const d = spec.direction;

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
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {spec.duration}s · {spec.mediaSlots.length} media slots · {spec.textSlots.length} text moments
        </p>
        {d && <p className="line-clamp-2 text-xs text-muted-foreground/80">{d.creativeIdea}</p>}
      </div>

      <div className="flex gap-2">
        <Button asChild className="flex-1 font-semibold">
          <Link to="/editor/$id" params={{ id: spec.id }}>
            Use Template
          </Link>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setDna((v) => !v)}
          aria-label="View DNA"
        >
          <Dna className="size-4" />
        </Button>
      </div>

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
          {segments.length > 0 && (
            <Row
              k="Reel sections"
              v={segments.map((s) => `${s.from.toFixed(1)}–${s.to.toFixed(1)}s`).join(" · ")}
            />
          )}
          <div className="flex gap-2 pt-1">
            {onRegenerate && (
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => onRegenerate(spec)}>
                <Sparkles className="size-3.5" /> Generate Similar
              </Button>
            )}
            {onRemix && (
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => onRemix(spec)}>
                <Shuffle className="size-3.5" /> Remix
              </Button>
            )}
          </div>
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
