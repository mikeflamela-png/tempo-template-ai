import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Heart, Minus, Plus, Shuffle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplatePlayer } from "@/components/video/TemplatePlayer";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { cachedUrl } from "@/lib/footage/db";
import { projectById, projectClips, updateProject, updateVersion, useFootage } from "@/lib/footage/store";
import { useSourceUrls } from "@/lib/footage/useSources";
import {
  alternativesFor,
  deleteShot,
  mediaMapFor,
  shuffleSection,
  shuffleShot,
  swapShot,
  trimShot,
} from "@/lib/edit/build";
import type { AudioTrack } from "@/lib/template/types";
import { SHOT_TYPE_LABEL } from "@/lib/footage/types";

export const Route = createFileRoute("/p/$id/results")({
  head: () => ({
    meta: [
      { title: "Results — Tempo" },
      { name: "description", content: "Watch your generated edits, swap any shot you don't like, then export." },
      { property: "og:title", content: "Results — Tempo" },
      { property: "og:description", content: "Several finished edits, one click from export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { id } = useParams({ from: "/p/$id/results" });
  useFootage();
  const tick = useSourceUrls(id);
  const project = projectById(id);
  const clips = projectClips(id);
  const versions = project?.versions ?? [];

  const [activeId, setActiveId] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);

  const version = versions.find((v) => v.id === activeId) ?? versions[0] ?? null;

  const audio: AudioTrack | null = useMemo(() => {
    const m = project?.music;
    const url = m ? cachedUrl(m.id) : null;
    if (!m || !url) return null;
    return {
      url,
      name: m.name,
      duration: m.duration,
      trimStart: 0,
      volume: 1,
      fadeIn: 0.2,
      fadeOut: 0.6,
      beatMap: m.beatMap,
    };
  }, [project?.music, tick]);

  const media = useMemo(
    () => (version ? mediaMapFor(version, clips) : {}),
    [version, clips, tick],
  );

  if (!version) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-16 text-center">
        <p className="text-sm text-muted-foreground">No edits yet.</p>
        <Link to="/p/$id/make" params={{ id }} className="mt-4 inline-block text-sm text-primary">
          Make a video
        </Link>
      </div>
    );
  }

  const save = (next: typeof version) => {
    updateVersion(id, version.id, next);
    setActiveId(version.id);
  };

  const slots = [...version.spec.mediaSlots].sort((a, b) => a.start - b.start);
  const slot = slots.find((s) => s.id === slotId) ?? null;
  const currentClip = slot ? clips.find((c) => c.id === version.plan[slot.id]) ?? null : null;
  const alternatives = slot
    ? alternativesFor(
        clips,
        {
          need: slot.duration,
          wantType: currentClip?.shotType ?? null,
          used: Object.fromEntries(
            Object.entries(version.plan)
              .filter(([k]) => k !== slot.id)
              .map(([, v]) => [v, 1]),
          ),
        },
        6,
        currentClip?.id,
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => {
              setActiveId(v.id);
              setSlotId(null);
            }}
            className={`rounded-full border px-4 py-1.5 text-[11px] uppercase tracking-widest ${
              v.id === version.id
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.name}
            {v.favorite ? " ♥" : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div
            className="overflow-hidden rounded-2xl bg-black"
            style={{ aspectRatio: `${version.spec.width} / ${version.spec.height}`, maxHeight: "62vh", margin: "0 auto" }}
          >
            <TemplatePlayer
              key={`${version.id}-${JSON.stringify(version.plan)}-${tick}`}
              spec={version.spec}
              media={media}
              textOverrides={{}}
              audio={audio}
              autoPlay
              loop
            />
          </div>

          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-2">
            {slots.map((s, i) => {
              const clip = clips.find((c) => c.id === version.plan[s.id]);
              return (
                <button
                  key={s.id}
                  onClick={() => setSlotId(s.id === slotId ? null : s.id)}
                  className={`relative w-24 shrink-0 overflow-hidden rounded-lg border ${
                    slotId === s.id ? "border-primary ring-1 ring-primary" : "border-border"
                  }`}
                >
                  <div className="aspect-video bg-muted/30">
                    {clip?.thumb ? (
                      <img src={clip.thumb} alt="" loading="lazy" className="size-full object-cover" />
                    ) : null}
                  </div>
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-background/80 px-1 font-mono text-[9px]">
                    {s.duration.toFixed(1)}s
                  </span>
                  <span className="absolute left-0.5 top-0.5 rounded bg-background/80 px-1 font-mono text-[9px]">
                    {i + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => save(shuffleSection(version, slots.map((s) => s.id), clips))}
              className="gap-2"
            >
              <Shuffle className="size-3.5" /> Shuffle all
            </Button>
            {slotId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  save(
                    shuffleSection(
                      version,
                      slots
                        .slice(
                          Math.max(0, slots.findIndex((s) => s.id === slotId) - 1),
                          slots.findIndex((s) => s.id === slotId) + 2,
                        )
                        .map((s) => s.id),
                      clips,
                    ),
                  )
                }
                className="gap-2"
              >
                <Shuffle className="size-3.5" /> Shuffle section
              </Button>
            )}
            <button
              onClick={() => updateVersion(id, version.id, { favorite: !version.favorite })}
              className={`flex items-center gap-2 text-xs uppercase tracking-widest ${
                version.favorite ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className={`size-4 ${version.favorite ? "fill-primary" : ""}`} /> Favorite
            </button>
            <div className="ml-auto">
              <ExportDialog spec={version.spec} media={media} textOverrides={{}} audio={audio} />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          {!slot && (
            <p className="text-xs text-muted-foreground">
              Click any shot below the video to swap, shuffle, trim or delete it.
            </p>
          )}
          {slot && (
            <div className="space-y-4 rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm">{slot.label}</p>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {slot.duration.toFixed(2)}s
                </span>
              </div>
              {currentClip && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {currentClip.name}
                  {currentClip.shotType ? ` · ${SHOT_TYPE_LABEL[currentClip.shotType]}` : ""}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => save(shuffleShot(version, slot.id, clips))}
                  className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-widest hover:border-primary"
                >
                  <Shuffle className="size-3" /> Shuffle
                </button>
                <button
                  onClick={() => save(trimShot(version, slot.id, slot.duration - 0.2))}
                  aria-label="Shorten shot"
                  className="rounded-full border border-border p-1.5 hover:border-primary"
                >
                  <Minus className="size-3" />
                </button>
                <button
                  onClick={() => save(trimShot(version, slot.id, slot.duration + 0.2))}
                  aria-label="Lengthen shot"
                  className="rounded-full border border-border p-1.5 hover:border-primary"
                >
                  <Plus className="size-3" />
                </button>
                <button
                  onClick={() => {
                    save(deleteShot(version, slot.id));
                    setSlotId(null);
                  }}
                  aria-label="Delete shot"
                  className="rounded-full border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Swap shot
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {alternatives.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => save(swapShot(version, slot.id, c))}
                      className="overflow-hidden rounded-lg border border-border hover:border-primary"
                    >
                      <div className="aspect-video bg-muted/30">
                        {c.thumb ? (
                          <img src={c.thumb} alt="" loading="lazy" className="size-full object-cover" />
                        ) : null}
                      </div>
                      <p className="truncate px-1 py-0.5 text-left text-[9px] text-muted-foreground">
                        {"★".repeat(c.rating)} {(c.out - c.in).toFixed(1)}s
                      </p>
                    </button>
                  ))}
                  {!alternatives.length && (
                    <p className="text-[11px] text-muted-foreground">No other clips fit this slot.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => updateProject(id, { versions: [] })}
            className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive"
          >
            Clear edits
          </button>
        </aside>
      </div>
    </div>
  );
}
