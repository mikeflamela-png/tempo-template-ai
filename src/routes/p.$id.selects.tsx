import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClipVideo from "@/components/selects/ClipVideo";
import StarRating from "@/components/selects/StarRating";
import TrimBar from "@/components/selects/TrimBar";
import { projectClips, updateClip, useFootage } from "@/lib/footage/store";
import { SHOT_TYPES, SHOT_TYPE_LABEL } from "@/lib/footage/types";

export const Route = createFileRoute("/p/$id/selects")({
  head: () => ({
    meta: [
      { title: "Selects — Tempo" },
      { name: "description", content: "Rate, favorite, reject and trim your footage in seconds with keyboard shortcuts." },
      { property: "og:title", content: "Selects — Tempo" },
      { property: "og:description", content: "Rapid-fire footage review: stars, favorites, rejects, trims." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SelectsPage,
});

function SelectsPage() {
  const { id } = useParams({ from: "/p/$id/selects" });
  useFootage();
  const clips = projectClips(id);
  const [index, setIndex] = useState(0);
  const [playhead, setPlayhead] = useState(0);

  const clip = clips[Math.min(index, Math.max(0, clips.length - 1))] ?? null;
  const reviewed = useMemo(
    () => clips.filter((c) => c.rating > 0 || c.rejected).length,
    [clips],
  );

  const advance = useCallback(() => {
    setIndex((i) => Math.min(clips.length - 1, i + 1));
  }, [clips.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!clip) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key >= "1" && e.key <= "5") {
        updateClip(clip.id, { rating: Number(e.key), rejected: false });
        advance();
      } else if (e.key.toLowerCase() === "f") {
        updateClip(clip.id, { favorite: !clip.favorite });
      } else if (e.key.toLowerCase() === "x") {
        updateClip(clip.id, { rejected: true });
        advance();
      } else if (e.key === "ArrowRight") advance();
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clip, advance]);

  if (!clips.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-16 text-center">
        <p className="text-sm text-muted-foreground">No clips yet.</p>
        <Link to="/p/$id/footage" params={{ id }} className="mt-4 inline-block text-sm text-primary">
          Upload footage
        </Link>
      </div>
    );
  }

  if (!clip) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${(reviewed / clips.length) * 100}%` }}
          />
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {reviewed} / {clips.length} reviewed
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="relative aspect-[9/16] max-h-[62vh] overflow-hidden rounded-2xl bg-black sm:aspect-video">
            <ClipVideo
              key={clip.id}
              clip={clip}
              className="size-full object-contain"
              onTime={setPlayhead}
            />
            <span className="absolute left-3 top-3 rounded bg-background/70 px-2 py-1 font-mono text-[10px]">
              {index + 1} / {clips.length}
            </span>
          </div>

          <div className="mt-4">
            <TrimBar clip={clip} playhead={playhead} onChange={(patch) => updateClip(clip.id, patch)} />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              aria-label="Previous clip"
              className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-5" />
            </button>
            <StarRating
              value={clip.rating}
              size="lg"
              onChange={(v) => {
                updateClip(clip.id, { rating: v, rejected: false });
                advance();
              }}
            />
            <button
              onClick={() => updateClip(clip.id, { favorite: !clip.favorite })}
              aria-label="Favorite"
              className={`rounded-full border p-2 ${
                clip.favorite ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className={`size-5 ${clip.favorite ? "fill-primary" : ""}`} />
            </button>
            <button
              onClick={() => {
                updateClip(clip.id, { rejected: !clip.rejected });
                if (!clip.rejected) advance();
              }}
              className={`flex items-center gap-2 rounded-full border px-5 py-2 text-xs uppercase tracking-[0.2em] ${
                clip.rejected
                  ? "border-destructive bg-destructive/20 text-destructive"
                  : "border-border text-muted-foreground hover:border-destructive hover:text-destructive"
              }`}
            >
              <X className="size-4" /> Reject
            </button>
            <button
              onClick={advance}
              aria-label="Next clip"
              className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            1–5 rate · F favorite · X reject · ← → navigate
          </p>
        </div>

        <aside className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Shot type</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SHOT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => updateClip(clip.id, { shotType: clip.shotType === t ? null : t })}
                  className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-widest ${
                    clip.shotType === t
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {SHOT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Optional — stars alone work fine.</p>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-4">
            <p className="truncate text-xs">{clip.name}</p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {(clip.out - clip.in).toFixed(2)}s selected
            </p>
          </div>

          <Link to="/p/$id/make" params={{ id }} className="block">
            <Button className="w-full">Make a video</Button>
          </Link>
          <Link
            to="/p/$id/footage"
            params={{ id }}
            className="block text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            Clip library
          </Link>
        </aside>
      </div>
    </div>
  );
}
