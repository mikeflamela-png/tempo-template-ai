import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import type { PlayerRef } from "@remotion/player";
import {
  ArrowLeft,
  Film,
  ImageIcon,
  Save,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TemplatePlayer } from "@/components/video/TemplatePlayer";
import { findTemplate, reshuffleReel, saveProject, useTemplateStore } from "@/lib/template/store";
import { PreviewReelControl } from "@/components/PreviewReelControl";
import { reelMediaFor } from "@/lib/template/reel";
import { syncSpecToTrack } from "@/lib/template/sync";
import { FONTS, FONT_CATEGORIES, fontByKey } from "@/lib/template/fonts";
import { Timeline } from "@/components/editor/Timeline";
import { SourceScrubber } from "@/components/editor/SourceScrubber";
import { MusicPanel } from "@/components/editor/MusicPanel";
import { GraphicsPanel } from "@/components/editor/GraphicsPanel";
import { TextInspector } from "@/components/editor/TextInspector";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { MomentEditor } from "@/components/editor/MomentEditor";
import VariationMatrix from "@/components/creative/VariationMatrix";
import FeedbackDialog from "@/components/taste/FeedbackDialog";
import { brandById, copyKitById, useBrandStore } from "@/lib/brand/store";
import { Heart, ThumbsDown } from "lucide-react";
import type {
  GraphicSlot,
  MediaAssignment,
  MediaMap,
  TemplateSpec,
  TextSlot,
} from "@/lib/template/types";

export const Route = createFileRoute("/editor/$id")({
  head: () => ({
    meta: [
      { title: "Edit — Tempo" },
      {
        name: "description",
        content:
          "Stringout-first editing: drop one reel in, drag each shot window through the source, sync to music, add graphics and export.",
      },
      { property: "og:title", content: "Edit — Tempo" },
      {
        property: "og:description",
        content: "Swap media, retime to the beat and control every text and graphic layer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditorPage,
});

interface LibraryItem {
  id: string;
  url: string;
  kind: "image" | "video";
  name: string;
}

type Selection = { kind: "media" | "text" | "graphic"; id: string } | null;

function EditorPage() {
  const { id } = useParams({ from: "/editor/$id" });
  const base = useMemo<TemplateSpec | undefined>(() => findTemplate(id), [id]);
  const { reel, reelShuffle, audio } = useTemplateStore();

  const [fontKey, setFontKey] = useState<string | null>(null);
  const [edits, setEdits] = useState<Partial<TemplateSpec>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [selection, setSelection] = useState<Selection>(null);
  const [tightness, setTightness] = useState(0.5);
  const [syncedSpec, setSyncedSpec] = useState<TemplateSpec | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [feedback, setFeedback] = useState<"love" | "dislike" | null>(null);
  const brandStore = useBrandStore();
  const activeBrand = brandById(brandStore.activeKitId);
  const activeCopy = copyKitById(brandStore.activeCopyId);

  const playerRef = useRef<PlayerRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const spec = useMemo<TemplateSpec | undefined>(() => {
    if (!base) return undefined;
    const merged: TemplateSpec = {
      ...base,
      ...edits,
      ...(fontKey ? { fontKey } : {}),
    };
    return syncedSpec ? { ...syncedSpec, ...(fontKey ? { fontKey } : {}) } : merged;
  }, [base, edits, fontKey, syncedSpec]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !spec) return;
    const onFrame = () => setPlayhead((p.getCurrentFrame?.() ?? 0) / spec.fps);
    const t = window.setInterval(onFrame, 250);
    return () => window.clearInterval(t);
  }, [spec]);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const items: LibraryItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .map((f) => ({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
        url: URL.createObjectURL(f),
        kind: f.type.startsWith("video/") ? "video" : "image",
        name: f.name,
      }));
    if (items.length) setLibrary((prev) => [...prev, ...items]);
  }, []);

  const previewMedia: MediaMap = useMemo(
    () => (spec ? { ...reelMediaFor(spec, reel, reelShuffle), ...media } : media),
    [spec, reel, reelShuffle, media],
  );

  if (!spec || !base) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">That template isn&apos;t in this browser&apos;s library.</p>
        <Button asChild>
          <Link to="/">Back to Tempo</Link>
        </Button>
      </main>
    );
  }

  const graphics = spec.graphicSlots ?? [];

  const patchSpec = (patch: Partial<TemplateSpec>) => {
    if (syncedSpec) setSyncedSpec({ ...syncedSpec, ...patch });
    else setEdits((prev) => ({ ...prev, ...patch }));
  };

  const patchText = (slotId: string, patch: Partial<TextSlot>) =>
    patchSpec({
      textSlots: spec.textSlots.map((t) => (t.id === slotId ? { ...t, ...patch } : t)),
    });

  const patchGraphic = (gid: string, patch: Partial<GraphicSlot>) =>
    patchSpec({ graphicSlots: graphics.map((g) => (g.id === gid ? { ...g, ...patch } : g)) });

  const assign = (slotId: string, item: LibraryItem) => {
    setMedia((prev) => ({
      ...prev,
      [slotId]: {
        url: item.url,
        kind: item.kind,
        name: item.name,
        inPoint: 0,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        muted: true,
        speed: 1,
        opacity: 1,
        rotation: 0,
        fit: "cover",
      },
    }));
    setSelection({ kind: "media", id: slotId });
  };

  const update = (slotId: string, patch: Partial<MediaAssignment>) =>
    setMedia((prev) => {
      const cur = prev[slotId] ?? previewMedia[slotId];
      if (!cur) return prev;
      return { ...prev, [slotId]: { ...cur, ...patch } };
    });

  const clear = (slotId: string) =>
    setMedia((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });

  const autoFill = () => {
    if (!reel) {
      toast.error("Upload a preview reel first");
      return;
    }
    setMedia({});
    toast.success("Every shot filled from the reel");
  };

  const doSync = () => {
    if (!audio) return;
    setSyncedSpec(syncSpecToTrack({ ...base, ...edits }, audio, tightness));
    toast.success(tightness < 0.5 ? "Loosely retimed to the track" : "Snapped to the beat grid");
  };

  const selected = selection;
  const selectedSlot = selected?.kind === "media" ? spec.mediaSlots.find((s) => s.id === selected.id) : undefined;
  const selectedAsset = selectedSlot ? previewMedia[selectedSlot.id] : undefined;
  const selectedText = selected?.kind === "text" ? spec.textSlots.find((t) => t.id === selected.id) : undefined;
  const filled = Object.keys(previewMedia).length;

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="size-4" /> Templates
            </Link>
          </Button>
          <div>
            <p className="display-tight text-base">{spec.name}</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {spec.duration.toFixed(1)}s · {spec.mediaSlots.length} shots · {filled} filled
              {syncedSpec ? " · beat-synced" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PreviewReelControl compact />
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              saveProject({
                id: `${spec.id}-project`,
                templateId: spec.id,
                name: spec.name,
                spec,
                textOverrides: texts,
                mediaNames: Object.fromEntries(
                  Object.entries(media).map(([k, v]) => [k, v.name]),
                ),
              }) && toast.success("Project saved")
            }
          >
            <Save className="size-4" /> Save
          </Button>
          <ExportDialog spec={spec} media={previewMedia} textOverrides={texts} audio={audio} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[270px_1fr_340px]">
        {/* media panel */}
        <aside className="min-h-0 space-y-5 overflow-y-auto border-r border-border p-4">
          <div>
            <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Stringout
            </h2>
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" className="flex-1" onClick={autoFill}>
                <Wand2 className="size-3.5" /> Auto-fill
              </Button>
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => reshuffleReel()}>
                <Shuffle className="size-3.5" /> Reshuffle
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMedia({})}>
                Clear
              </Button>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Your media
            </h2>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-7 text-center text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground"
            >
              <Upload className="size-5" />
              Drop clips, images or logos
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {library.map((item) => (
                <button
                  key={item.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                  onClick={() => selectedSlot && assign(selectedSlot.id, item)}
                  title={selectedSlot ? "Click to place in selected shot" : "Select a shot first"}
                  className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-border"
                >
                  {item.kind === "image" ? (
                    <img src={item.url} alt={item.name} className="size-full object-cover" />
                  ) : (
                    <video src={item.url} muted className="size-full object-cover" />
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 text-[9px]">
                    {item.kind === "video" ? (
                      <Film className="size-3" />
                    ) : (
                      <ImageIcon className="size-3" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <MusicPanel
            audio={audio}
            tightness={tightness}
            onTightness={setTightness}
            onSync={doSync}
            onUnsync={() => setSyncedSpec(null)}
            synced={Boolean(syncedSpec)}
          />
        </aside>

        {/* preview + timeline */}
        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4">
            <div
              className="max-h-full overflow-hidden rounded-2xl border border-border bg-black"
              style={{ aspectRatio: `${spec.width} / ${spec.height}`, height: "100%" }}
            >
              <TemplatePlayer
                ref={playerRef}
                spec={spec}
                media={previewMedia}
                textOverrides={texts}
                audio={audio}
                controls
                loop
              />
            </div>
          </div>
          <Timeline
            spec={spec}
            playerRef={playerRef}
            audio={audio}
            selected={selection?.id ?? null}
            onSelect={(kind, sid) => setSelection({ kind, id: sid })}
            thumbs={{}}
          />
        </section>

        {/* inspector */}
        <aside className="min-h-0 space-y-6 overflow-y-auto border-l border-border p-4">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setFeedback("love")}>
              <Heart className="size-3.5" /> Love this
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setFeedback("dislike")}>
              <ThumbsDown className="size-3.5" /> Not it
            </Button>
          </div>
          <FeedbackDialog
            targetId={spec.id}
            kind={feedback ?? "love"}
            open={feedback !== null}
            onOpenChange={(o) => !o && setFeedback(null)}
          />
          <VariationMatrix
            base={spec}
            media={previewMedia}
            textOverrides={texts}
            audio={audio}
            brand={activeBrand}
            copy={activeCopy}
            onSelect={(next) => {
              setSyncedSpec(next);
              setEdits((prev) => ({ ...prev, ...next }));
            }}
          />
          <MomentEditor
            spec={spec}
            media={previewMedia}
            playhead={playhead}
            onChange={(creativeEvents) => {
              setSyncedSpec((prev) => (prev ? { ...prev, creativeEvents } : prev));
              setEdits((prev) => ({ ...prev, creativeEvents }));
            }}
          />
          <div>
            <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Typography
            </h2>
            <select
              value={fontKey ?? base.fontKey ?? FONTS[0]!.key}
              onChange={(e) => setFontKey(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {FONT_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {FONTS.filter((f) => f.category === cat).map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {fontByKey(spec.fontKey).category} · every text moment unless overridden
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Shots
            </h2>
            <div className="space-y-2">
              {spec.mediaSlots.map((slot, i) => {
                const asset = previewMedia[slot.id];
                const isActive = selection?.kind === "media" && selection.id === slot.id;
                return (
                  <div
                    key={slot.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const item = library.find(
                        (l) => l.id === e.dataTransfer.getData("text/plain"),
                      );
                      if (item) assign(slot.id, item);
                    }}
                    onClick={() => setSelection({ kind: "media", id: slot.id })}
                    className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                        {asset ? (
                          asset.kind === "image" ? (
                            <img src={asset.url} alt="" className="size-full object-cover" />
                          ) : (
                            <video src={asset.url} muted className="size-full object-cover" />
                          )
                        ) : (
                          <span className="flex size-full items-center justify-center text-[9px] text-muted-foreground">
                            drop
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold uppercase tracking-wider">
                          SHOT {String(i + 1).padStart(2, "0")} — {slot.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {slot.duration.toFixed(2)}s · {slot.layout} · {slot.animationIn}
                        </p>
                      </div>
                      {media[slot.id] && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clear(slot.id);
                          }}
                          aria-label="Remove media"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>

                    {isActive && asset && (
                      <div className="mt-3 space-y-3 border-t border-border pt-3">
                        {asset.kind === "video" && (
                          <SourceScrubber
                            url={asset.url}
                            sourceDuration={
                              reel && asset.url === reel.url ? reel.duration : slot.duration * 4
                            }
                            window={slot.duration}
                            inPoint={asset.inPoint ?? 0}
                            onChange={(v) => update(slot.id, { inPoint: v })}
                          />
                        )}
                        <Adjust
                          label={`Zoom ${(asset.zoom ?? 1).toFixed(2)}×`}
                          value={asset.zoom ?? 1}
                          min={1}
                          max={2.5}
                          step={0.05}
                          onChange={(v) => update(slot.id, { zoom: v })}
                        />
                        <Adjust
                          label="Crop X"
                          value={asset.offsetX ?? 0}
                          min={-30}
                          max={30}
                          step={1}
                          onChange={(v) => update(slot.id, { offsetX: v })}
                        />
                        <Adjust
                          label="Crop Y"
                          value={asset.offsetY ?? 0}
                          min={-30}
                          max={30}
                          step={1}
                          onChange={(v) => update(slot.id, { offsetY: v })}
                        />
                        <Adjust
                          label={`Rotation ${asset.rotation ?? 0}°`}
                          value={asset.rotation ?? 0}
                          min={-30}
                          max={30}
                          step={1}
                          onChange={(v) => update(slot.id, { rotation: v })}
                        />
                        <Adjust
                          label={`Opacity ${Math.round((asset.opacity ?? 1) * 100)}%`}
                          value={asset.opacity ?? 1}
                          min={0}
                          max={1}
                          step={0.05}
                          onChange={(v) => update(slot.id, { opacity: v })}
                        />
                        {asset.kind === "video" && (
                          <>
                            <Adjust
                              label={`Speed ${(asset.speed ?? 1).toFixed(2)}×`}
                              value={asset.speed ?? 1}
                              min={0.25}
                              max={3}
                              step={0.05}
                              onChange={(v) => update(slot.id, { speed: v })}
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full"
                              onClick={() => update(slot.id, { muted: !(asset.muted !== false) })}
                            >
                              {asset.muted !== false ? (
                                <>
                                  <VolumeX className="size-4" /> Muted
                                </>
                              ) : (
                                <>
                                  <Volume2 className="size-4" /> Audio on
                                </>
                              )}
                            </Button>
                          </>
                        )}
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant={asset.fit === "contain" ? "default" : "secondary"}
                            className="flex-1"
                            onClick={() =>
                              update(slot.id, {
                                fit: asset.fit === "contain" ? "cover" : "contain",
                              })
                            }
                          >
                            {asset.fit === "contain" ? "Contain" : "Cover"}
                          </Button>
                          <Button
                            size="sm"
                            variant={asset.flipX ? "default" : "secondary"}
                            className="flex-1"
                            onClick={() => update(slot.id, { flipX: !asset.flipX })}
                          >
                            Flip
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {selectedText && (
            <div>
              <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Text inspector
              </h2>
              <TextInspector
                slot={selectedText}
                duration={spec.duration}
                value={texts[selectedText.id] ?? selectedText.value}
                onValue={(v) => setTexts((prev) => ({ ...prev, [selectedText.id]: v }))}
                onUpdate={(patch) => patchText(selectedText.id, patch)}
              />
            </div>
          )}

          {!selectedText && spec.textSlots.length > 0 && (
            <div>
              <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Text moments
              </h2>
              <div className="space-y-1">
                {spec.textSlots.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelection({ kind: "text", id: t.id })}
                    className="flex w-full items-center justify-between rounded-md border border-border px-2 py-1.5 text-left text-[11px] hover:border-primary"
                  >
                    <span className="truncate">{texts[t.id] ?? t.value}</span>
                    <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                      {t.start.toFixed(1)}s
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <GraphicsPanel
            graphics={graphics}
            duration={spec.duration}
            selected={selection?.kind === "graphic" ? selection.id : null}
            onSelect={(gid) => setSelection({ kind: "graphic", id: gid })}
            onAdd={(g) => {
              patchSpec({ graphicSlots: [...graphics, g] });
              setSelection({ kind: "graphic", id: g.id });
            }}
            onUpdate={patchGraphic}
            onRemove={(gid) => patchSpec({ graphicSlots: graphics.filter((g) => g.id !== gid) })}
            playhead={Math.min(playhead, Math.max(0, spec.duration - 1))}
          />

          <p className="flex items-start gap-2 rounded-lg border border-border p-2 text-[11px] text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            {spec.creativeProfile.family} · {spec.creativeProfile.structure}
          </p>
        </aside>
      </div>
    </main>
  );
}

function Adjust({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Number((v[0] ?? value).toFixed(2)))}
      />
    </div>
  );
}
