import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { PlayerRef } from "@remotion/player";
import { Bookmark, BookmarkCheck, Play, Shuffle } from "lucide-react";
import { TemplatePlayer } from "@/components/video/TemplatePlayer";
import { Button } from "@/components/ui/button";
import type { TemplateSpec } from "@/lib/template/types";
import { toggleSaved, useTemplateStore } from "@/lib/template/store";

export function TemplateCard({
  spec,
  onRegenerate,
}: {
  spec: TemplateSpec;
  onRegenerate?: (spec: TemplateSpec) => void;
}) {
  const ref = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(false);
  const { saved } = useTemplateStore();
  const isSaved = saved.includes(spec.id);
  const primarySlots = spec.mediaSlots.length;

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
          media={{}}
          textOverrides={{}}
          controls={false}
          loop
          clickToPlay={false}
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
          {spec.duration}s · {primarySlots} media slots · {spec.textSlots.length} text moments
        </p>
        <p className="text-xs text-muted-foreground/80">
          {spec.creativeProfile.family} · {spec.creativeProfile.pacing}
        </p>
      </div>

      <div className="flex gap-2">
        <Button asChild className="flex-1 font-semibold">
          <Link to="/editor/$id" params={{ id: spec.id }}>
            Use Template
          </Link>
        </Button>
        {onRegenerate && (
          <Button variant="secondary" size="icon" onClick={() => onRegenerate(spec)} aria-label="Regenerate similar">
            <Shuffle className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}