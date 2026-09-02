import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Check, Film, Clapperboard, Group, Heart, Loader2, Scissors, Trash2, X, Merge } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ClipVideo from "@/components/selects/ClipVideo";
import StarRating from "@/components/selects/StarRating";
import TrimBar from "@/components/selects/TrimBar";
import {
  addToScene,
  deleteClip,
  groupAsScene,
  mergeWithNext,
  projectScenes,
  removeFromScene,
  renameScene,
  ungroupScene,
  projectById,
  projectClips,
  splitClip,
  updateClip,
  updateClips,
  useFootage,
} from "@/lib/footage/store";
import { suggestScenes, type SceneSuggestion } from "@/lib/footage/scenes";
import { ingestClipFiles, ingestStringout, type IngestProgress } from "@/lib/footage/ingest";
import { SHOT_TYPES, SHOT_TYPE_LABEL, type Clip, type ShotType } from "@/lib/footage/types";

export const Route = createFileRoute("/p/$id/footage")({
  head: () => ({
    meta: [
      { title: "Footage — Tempo" },
      { name: "description", content: "Upload a stringout or a pile of clips and let Tempo split it into reviewable shots." },
      { property: "og:title", content: "Footage — Tempo" },
      { property: "og:description", content: "Turn messy footage into an organised clip library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FootagePage,
});

type FilterKey =
  | "all"
  | "5"
  | "4"
  | "3"
  | "favorites"
  | "unrated"
  | "rejected"
  | ShotType;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "5", label: "★★★★★" },
  { key: "4", label: "★★★★+" },
  { key: "3", label: "★★★+" },
  { key: "favorites", label: "Favorites" },
  ...SHOT_TYPES.map((t) => ({ key: t as FilterKey, label: SHOT_TYPE_LABEL[t] })),
  { key: "unrated", label: "Unrated" },
  { key: "rejected", label: "Rejected" },
];

const SORTS = [
  { key: "rating", label: "Highest rated" },
  { key: "order", label: "Original order" },
  { key: "short", label: "Shortest" },
  { key: "long", label: "Longest" },
] as const;

function matches(clip: Clip, f: FilterKey) {
  if (f === "all") return !clip.rejected;
  if (f === "5") return !clip.rejected && clip.rating === 5;
  if (f === "4") return !clip.rejected && clip.rating >= 4;
  if (f === "3") return !clip.rejected && clip.rating >= 3;
  if (f === "favorites") return !clip.rejected && clip.favorite;
  if (f === "unrated") return !clip.rejected && clip.rating === 0;
  if (f === "rejected") return clip.rejected;
  return !clip.rejected && clip.shotType === f;
}

function FootagePage() {
  const { id } = useParams({ from: "/p/$id/footage" });
  useFootage();
  const project = projectById(id);
  const clips = projectClips(id);

  const [progress, setProgress] = useState<IngestProgress | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("order");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SceneSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const stringoutInput = useRef<HTMLInputElement>(null);
  const clipsInput = useRef<HTMLInputElement>(null);
  const scenes = projectScenes(id);

  const toggleSelect = (clipId: string) =>
    setSelected((s) => (s.includes(clipId) ? s.filter((x) => x !== clipId) : [...s, clipId]));

  const runSuggestions = async () => {
    setSuggesting(true);
    try {
      const found = await suggestScenes(clips);
      setSuggestions(found);
      if (!found.length) toast.info("No obvious scene groups found — group them manually.");
    } finally {
      setSuggesting(false);
    }
  };


  const shown = useMemo(() => {
    const list = clips.filter((c) => matches(c, filter));
    const sorted = [...list];
    if (sort === "rating")
      sorted.sort((a, b) => b.rating - a.rating || Number(b.favorite) - Number(a.favorite));
    if (sort === "short") sorted.sort((a, b) => a.out - a.in - (b.out - b.in));
    if (sort === "long") sorted.sort((a, b) => b.out - b.in - (a.out - a.in));
    return sorted;
  }, [clips, filter, sort]);

  const open = clips.find((c) => c.id === openId) ?? null;

  const runStringout = async (file: File) => {
    try {
      const made = await ingestStringout(id, file, setProgress);
      toast.success(`Detected ${made.length} shots`);
    } catch (e) {
      console.error("stringout ingest failed", e);
      toast.error(e instanceof Error ? e.message : "Could not process that video");
    } finally {
      setProgress(null);
    }
  };

  const runClips = async (files: File[]) => {
    try {
      const made = await ingestClipFiles(id, files, setProgress);
      toast.success(`Added ${made.length} clips`);
    } catch (e) {
      console.error("clip ingest failed", e);
      toast.error(e instanceof Error ? e.message : "Could not add those clips");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-8">
      <input
        ref={stringoutInput}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void runStringout(f);
        }}
      />
      <input
        ref={clipsInput}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void runClips(files);
        }}
      />

      {progress ? (
        <div className="rounded-2xl border border-border bg-card/50 p-8">
          <div className="flex items-center gap-3">
            <Loader2 className="size-4 animate-spin text-primary" />
            <p className="text-sm">{progress.label}</p>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Uploading → Detecting shots → Creating clips → Ready to review
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => stringoutInput.current?.click()}
            className="rounded-xl border border-dashed border-border p-6 text-left transition-colors hover:border-primary"
          >
            <Film className="size-5 text-primary" />
            <p className="mt-3 text-base">Upload stringout</p>
            <p className="mt-1 text-xs text-muted-foreground">
              One long video — Tempo detects the cuts and makes clips.
            </p>
          </button>
          <button
            onClick={() => clipsInput.current?.click()}
            className="rounded-xl border border-dashed border-border p-6 text-left transition-colors hover:border-primary"
          >
            <Clapperboard className="size-5 text-primary" />
            <p className="mt-3 text-base">Upload clips</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Any number of individual camera or phone files.
            </p>
          </button>
        </div>
      )}

      {clips.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-widest transition-colors ${
                  filter === f.key
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="rounded-full border border-border bg-transparent px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key} className="bg-background">
                    {s.label}
                  </option>
                ))}
              </select>
              <Link to="/p/$id/selects" params={{ id }}>
                <Button size="sm">Review clips</Button>
              </Link>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-card/95 px-4 py-3 backdrop-blur">
              <span className="text-xs">{selected.length} selected</span>
              <StarRating value={0} onChange={(v) => updateClips(selected, { rating: v })} />
              <button
                onClick={() => updateClips(selected, { favorite: true })}
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Favorite
              </button>
              <button
                onClick={() => updateClips(selected, { rejected: true })}
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive"
              >
                Reject
              </button>
              <select
                onChange={(e) =>
                  updateClips(selected, { shotType: (e.target.value || null) as ShotType | null })
                }
                defaultValue=""
                className="rounded-full border border-border bg-transparent px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground"
              >
                <option value="">Shot type…</option>
                {SHOT_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-background">
                    {SHOT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const name = window.prompt("Name this scene (optional)", "") ?? "";
                  const scene = groupAsScene(id, selected, name);
                  setSelected([]);
                  toast.success(`${scene.name} created`);
                }}
                className="flex items-center gap-1 rounded-full border border-primary/60 px-3 py-1 text-[11px] uppercase tracking-widest text-primary"
              >
                <Group className="size-3" /> Group as scene
              </button>
              {scenes.length > 0 && (
                <select
                  onChange={(e) => {
                    if (!e.target.value) return;
                    addToScene(e.target.value, selected);
                    setSelected([]);
                  }}
                  defaultValue=""
                  className="rounded-full border border-border bg-transparent px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground"
                >
                  <option value="">Add to scene…</option>
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id} className="bg-background">
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => {
                  removeFromScene(selected);
                  setSelected([]);
                }}
                className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Remove from scene
              </button>
              <button
                onClick={() => setSelected([])}
                className="ml-auto text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}

          {/* -------------------------------------------------- scene groups */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Scenes
            </span>
            {scenes.map((s) => {
              const members = clips.filter((c) => c.sceneId === s.id);
              return (
                <span
                  key={s.id}
                  className="flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-[11px]"
                >
                  <button
                    onClick={() => setSelected(members.map((m) => m.id))}
                    className="hover:text-primary"
                  >
                    {s.name} · {members.length}
                  </button>
                  <button
                    onClick={() => {
                      const name = window.prompt("Rename scene", s.name);
                      if (name) renameScene(s.id, name);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => ungroupScene(s.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Ungroup
                  </button>
                </span>
              );
            })}
            {!scenes.length && (
              <span className="text-[11px] text-muted-foreground">
                Select clips, then Group as scene.
              </span>
            )}
            <button
              onClick={() => void runSuggestions()}
              disabled={suggesting}
              className="ml-auto text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              {suggesting ? "Looking…" : "Suggest scenes"}
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-2 rounded-xl border border-dashed border-primary/40 p-3">
              {suggestions.map((sg) => {
                const members = clips.filter((c) => sg.clipIds.includes(c.id));
                return (
                  <div key={sg.id} className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {members.slice(0, 6).map((m) =>
                        m.thumb ? (
                          <img
                            key={m.id}
                            src={m.thumb}
                            alt={m.name}
                            className="h-8 w-12 rounded object-cover"
                          />
                        ) : null,
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Suggested scene · {members.length} clips
                    </p>
                    <button
                      onClick={() => {
                        groupAsScene(id, sg.clipIds);
                        setSuggestions((s) => s.filter((x) => x.id !== sg.id));
                      }}
                      className="ml-auto rounded-full border border-primary/60 px-3 py-1 text-[11px] uppercase tracking-widest text-primary"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => setSuggestions((s) => s.filter((x) => x.id !== sg.id))}
                      className="text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                    >
                      Ignore
                    </button>
                  </div>
                );
              })}
            </div>
          )}


          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((c) => {
              const isSel = selected.includes(c.id);
              return (
                <div
                  key={c.id}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey) {
                      setSelected((s) =>
                        s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id],
                      );
                    } else setOpenId(c.id);
                  }}
                  className={`group cursor-pointer overflow-hidden rounded-xl border bg-card/40 transition-all ${
                    isSel ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/60"
                  } ${c.rejected ? "opacity-40" : ""}`}
                >
                  <div className="relative aspect-video bg-muted/30">
                    {c.thumb ? (
                      <img src={c.thumb} alt={c.name} loading="lazy" className="size-full object-cover" />
                    ) : null}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(c.id);
                      }}
                      aria-label={isSel ? "Deselect clip" : "Select clip"}
                      className={`absolute right-1 top-1 flex size-5 items-center justify-center rounded-full border transition-opacity ${
                        isSel
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background/70 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <Check className="size-3" />
                    </button>
                    {c.sceneId && (
                      <span className="absolute bottom-1 left-1 max-w-[70%] truncate rounded bg-primary/80 px-1 text-[9px] uppercase tracking-widest text-primary-foreground">
                        {scenes.find((s) => s.id === c.sceneId)?.name ?? "Scene"}
                      </span>
                    )}
                    <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 font-mono text-[10px]">
                      {(c.out - c.in).toFixed(1)}s
                    </span>

                    {c.favorite && (
                      <Heart className="absolute left-1 top-1 size-3.5 fill-primary text-primary" />
                    )}
                    {c.rejected && (
                      <span className="absolute left-1 top-1 rounded bg-destructive/80 px-1 text-[9px] uppercase">
                        Rejected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <StarRating value={c.rating} onChange={(v) => updateClip(c.id, { rating: v })} />
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                      {c.shotType ? SHOT_TYPE_LABEL[c.shotType] : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!clips.length && !progress && (
        <p className="text-sm text-muted-foreground">
          {project?.kind === "clips"
            ? "Drop in your camera and phone clips to get started."
            : "Upload your stringout and Tempo will split it into individual shots."}
        </p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="truncate text-sm">{open.name}</p>
              <button onClick={() => setOpenId(null)} aria-label="Close">
                <X className="size-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="aspect-video overflow-hidden rounded-xl bg-black">
              <ClipVideo clip={open} className="size-full object-contain" />
            </div>
            <div className="mt-4">
              <TrimBar clip={open} onChange={(patch) => updateClip(open.id, patch)} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StarRating value={open.rating} onChange={(v) => updateClip(open.id, { rating: v })} size="lg" />
              <button
                onClick={() => updateClip(open.id, { favorite: !open.favorite })}
                className={open.favorite ? "text-primary" : "text-muted-foreground hover:text-foreground"}
                aria-label="Favorite"
              >
                <Heart className={`size-5 ${open.favorite ? "fill-primary" : ""}`} />
              </button>
              <button
                onClick={() => updateClip(open.id, { rejected: !open.rejected })}
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive"
              >
                {open.rejected ? "Un-reject" : "Reject"}
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => mergeWithNext(open.id)}
                  className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <Merge className="size-3.5" /> Merge next
                </button>
                <button
                  onClick={() => splitClip(open.id, (open.in + open.out) / 2)}
                  className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <Scissors className="size-3.5" /> Split
                </button>
                <button
                  onClick={() => {
                    deleteClip(open.id);
                    setOpenId(null);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete clip"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SHOT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() =>
                    updateClip(open.id, { shotType: open.shotType === t ? null : t })
                  }
                  className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-widest ${
                    open.shotType === t
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {SHOT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
