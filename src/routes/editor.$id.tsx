import { useCallback, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import type { PlayerRef } from "@remotion/player";
import { ArrowLeft, Download, Film, ImageIcon, Trash2, Upload, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TemplatePlayer } from "@/components/video/TemplatePlayer";
import { findTemplate } from "@/lib/template/store";
import type { MediaAssignment, MediaMap, TemplateSpec } from "@/lib/template/types";

export const Route = createFileRoute("/editor/$id")({
  head: () => ({
    meta: [
      { title: "Customize template — Template Lab" },
      {
        name: "description",
        content:
          "Drop your clips into the template's media slots, edit the text moments, and preview the edit instantly.",
      },
      { property: "og:title", content: "Customize template — Template Lab" },
      {
        property: "og:description",
        content: "Replace placeholder media while the template's edit stays intact.",
      },
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

function EditorPage() {
  const { id } = useParams({ from: "/editor/$id" });
  const spec = useMemo<TemplateSpec | undefined>(() => findTemplate(id), [id]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const playerRef = useRef<PlayerRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (items.length === 0) return;
    setLibrary((prev) => [...prev, ...items]);
  }, []);

  if (!spec) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">That template isn't in this browser's library.</p>
        <Button asChild>
          <Link to="/">Back to Template Lab</Link>
        </Button>
      </main>
    );
  }

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
      },
    }));
    setActiveSlot(slotId);
  };

  const update = (slotId: string, patch: Partial<MediaAssignment>) =>
    setMedia((prev) => {
      const cur = prev[slotId];
      if (!cur) return prev;
      return { ...prev, [slotId]: { ...cur, ...patch } };
    });

  const clear = (slotId: string) =>
    setMedia((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });

  const exportProject = () => {
    const payload = {
      spec,
      textOverrides: texts,
      slots: Object.fromEntries(
        Object.entries(media).map(([k, v]) => [
          k,
          { name: v.name, kind: v.kind, inPoint: v.inPoint, zoom: v.zoom, muted: v.muted },
        ]),
      ),
      output: { width: spec.width, height: spec.height, codec: "h264", container: "mp4" },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${spec.name.toLowerCase().replace(/\s+/g, "-")}-render.json`;
    a.click();
    toast("Render job exported", {
      description:
        "1080×1920 H.264 rendering runs on a Remotion render worker — not yet connected in this MVP build.",
    });
  };

  const filled = Object.keys(media).length;

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="size-4" /> Templates
            </Link>
          </Button>
          <div>
            <p className="display-tight text-base">{spec.name}</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {spec.duration}s · {spec.mediaSlots.length} slots · {filled} filled
            </p>
          </div>
        </div>
        <Button onClick={exportProject} className="font-semibold">
          <Download className="size-4" /> Export MP4
        </Button>
      </header>

      <div className="grid flex-1 gap-0 lg:grid-cols-[260px_1fr_340px]">
        {/* Your media */}
        <aside className="border-r border-border p-4">
          <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Your media
          </h2>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <Upload className="size-5" />
            Drop clips or images
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {library.map((item) => (
              <button
                key={item.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                onClick={() => activeSlot && assign(activeSlot, item)}
                title={activeSlot ? "Click to place in selected slot" : "Select a slot first"}
                className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-border"
              >
                {item.kind === "image" ? (
                  <img src={item.url} alt={item.name} className="size-full object-cover" />
                ) : (
                  <video src={item.url} muted className="size-full object-cover" />
                )}
                <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 text-[9px]">
                  {item.kind === "video" ? <Film className="size-3" /> : <ImageIcon className="size-3" />}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Preview */}
        <section className="flex flex-col items-center justify-center gap-4 bg-black/40 p-6">
          <div
            className="h-[68vh] overflow-hidden rounded-2xl border border-border bg-black"
            style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
          >
            <TemplatePlayer
              ref={playerRef}
              spec={spec}
              media={media}
              textOverrides={texts}
              controls
              loop
            />
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {spec.creativeProfile.family} · {spec.creativeProfile.structure}
          </p>
        </section>

        {/* Slots + text */}
        <aside className="max-h-[calc(100vh-57px)] space-y-6 overflow-y-auto border-l border-border p-4">
          <div>
            <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Replace media
            </h2>
            <div className="space-y-2">
              {spec.mediaSlots.map((slot, i) => {
                const asset = media[slot.id];
                const isActive = activeSlot === slot.id;
                return (
                  <div
                    key={slot.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const item = library.find((l) => l.id === e.dataTransfer.getData("text/plain"));
                      if (item) assign(slot.id, item);
                    }}
                    onClick={() => setActiveSlot(slot.id)}
                    className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                      isActive ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
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
                      {asset && (
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
                          <Adjust
                            label={`In point ${(asset.inPoint ?? 0).toFixed(1)}s`}
                            value={asset.inPoint ?? 0}
                            min={0}
                            max={20}
                            step={0.1}
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
                        {asset.kind === "video" && (
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
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {spec.textSlots.length > 0 && (
            <div>
              <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Text
              </h2>
              <div className="space-y-3">
                {spec.textSlots.map((t) => (
                  <div key={t.id} className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      {t.label} · {t.start.toFixed(1)}s
                    </Label>
                    <Input
                      value={texts[t.id] ?? t.value}
                      onChange={(e) => setTexts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
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
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </div>
  );
}