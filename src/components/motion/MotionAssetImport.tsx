/**
 * Motion Asset Import panel: drop/pick a file, classify it (category, tags,
 * quality level), preview it live over the caller's preview node, tune the
 * default placement (speed/scale/position/opacity/duration/loop/reverse/
 * blend), file it into a Motion Kit, then save it to the library.
 */
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOTION_PACKS } from "@/lib/motion/packs";
import {
  MOTION_ASSET_CATEGORIES,
  MOTION_ASSET_QUALITIES,
  assetKind,
  deleteMotionAsset,
  importMotionAsset,
  updateMotionAsset,
  useMotionAssets,
  type BlendModeName,
  type MotionAsset,
  type MotionAssetCategory,
  type MotionAssetQuality,
} from "@/lib/motion/assets";

const BLEND_MODES: BlendModeName[] = [
  "normal",
  "screen",
  "multiply",
  "overlay",
  "lighten",
  "difference",
  "soft-light",
];

interface Props {
  previewSlot?: React.ReactNode;
}

interface Draft {
  file: File;
  url: string;
  category: MotionAssetCategory;
  tags: string;
  quality: MotionAssetQuality;
  speed: number;
  scale: number;
  x: number;
  y: number;
  opacity: number;
  duration: number;
  loop: boolean;
  reverse: boolean;
  blend: BlendModeName;
  kitKey: string;
}

function newDraft(file: File): Draft {
  return {
    file,
    url: URL.createObjectURL(file),
    category: "other",
    tags: "",
    quality: "specialty",
    speed: 1,
    scale: 1,
    x: 0,
    y: 0,
    opacity: 1,
    duration: 2,
    loop: false,
    reverse: false,
    blend: "screen",
    kitKey: "",
  };
}

function AssetPreviewMedia({ draft }: { draft: Draft }) {
  const kind = assetKind({ mime: draft.file.type, fileName: draft.file.name });
  const style: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: draft.opacity,
    mixBlendMode: draft.blend as React.CSSProperties["mixBlendMode"],
    transform: `translate(${draft.x * 100}%, ${draft.y * 100}%) scale(${draft.scale})`,
    pointerEvents: "none",
  };
  return (
    <div style={style}>
      {kind === "image" || kind === "svg" ? (
        <img src={draft.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%" }} />
      ) : kind === "video" ? (
        <video
          src={draft.url}
          autoPlay
          muted
          loop={draft.loop}
          ref={(el) => {
            if (el) el.playbackRate = Math.max(0.1, draft.speed);
          }}
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        />
      ) : kind === "audio" ? (
        <div className="text-xs text-muted-foreground">audio preview: play on save</div>
      ) : (
        <div className="text-xs text-muted-foreground">lottie preview unavailable</div>
      )}
    </div>
  );
}

export default function MotionAssetImport({ previewSlot }: Props) {
  const assets = useMotionAssets();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const onFile = (file: File | undefined | null) => {
    if (!file) return;
    setDraft(newDraft(file));
  };

  const handleSave = async () => {
    if (!draft) return;
    const asset = await importMotionAsset(draft.file, {
      category: draft.category,
      tags: draft.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      quality: draft.quality,
      defaultScale: draft.scale,
      defaultX: draft.x,
      defaultY: draft.y,
      defaultOpacity: draft.opacity,
      durationSec: draft.duration,
      loop: draft.loop,
      reverse: draft.reverse,
      speed: draft.speed,
      blend: draft.blend,
      kitKeys: draft.kitKey ? [draft.kitKey] : [],
    });
    void asset;
    URL.revokeObjectURL(draft.url);
    setDraft(null);
  };

  const grouped = useMemo(() => assets, [assets]);

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-8 text-center text-sm transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border text-muted-foreground"
        }`}
      >
        <p>Drop a motion asset here or click to browse</p>
        <p className="mt-1 text-xs opacity-70">SVG · PNG/WebP · GIF · WebM/MOV alpha · Lottie JSON · audio</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".svg,.png,.webp,.gif,.webm,.mov,.json,.lottie,.mp3,.wav,.m4a,video/*,image/*,audio/*,application/json"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      {draft && (
        <div className="flex flex-col gap-4 rounded-md border border-border p-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
            {previewSlot}
            <AssetPreviewMedia draft={draft} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={draft.category} onValueChange={(v) => patch({ category: v as MotionAssetCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTION_ASSET_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Quality level</Label>
              <Select value={draft.quality} onValueChange={(v) => patch({ quality: v as MotionAssetQuality })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTION_ASSET_QUALITIES.map((q) => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Tags (comma separated)</Label>
              <Input value={draft.tags} onChange={(e) => patch({ tags: e.target.value })} placeholder="grunge, warm, editorial" />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Blend mode</Label>
              <Select value={draft.blend} onValueChange={(v) => patch({ blend: v as BlendModeName })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLEND_MODES.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SliderField label={`Speed ${draft.speed.toFixed(2)}x`} value={draft.speed} min={0.1} max={3} step={0.05} onChange={(v) => patch({ speed: v })} />
            <SliderField label={`Scale ${draft.scale.toFixed(2)}x`} value={draft.scale} min={0.1} max={3} step={0.05} onChange={(v) => patch({ scale: v })} />
            <SliderField label={`X ${(draft.x * 100).toFixed(0)}%`} value={draft.x} min={-1} max={1} step={0.01} onChange={(v) => patch({ x: v })} />
            <SliderField label={`Y ${(draft.y * 100).toFixed(0)}%`} value={draft.y} min={-1} max={1} step={0.01} onChange={(v) => patch({ y: v })} />
            <SliderField label={`Opacity ${(draft.opacity * 100).toFixed(0)}%`} value={draft.opacity} min={0} max={1} step={0.01} onChange={(v) => patch({ opacity: v })} />
            <SliderField label={`Duration ${draft.duration.toFixed(1)}s`} value={draft.duration} min={0.2} max={12} step={0.1} onChange={(v) => patch({ duration: v })} />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={draft.loop} onCheckedChange={(v) => patch({ loop: v })} />
              <Label>Loop</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={draft.reverse} onCheckedChange={(v) => patch({ reverse: v })} />
              <Label>Reverse</Label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Add to Motion Kit</Label>
            <Select value={draft.kitKey} onValueChange={(v) => patch({ kitKey: v })}>
              <SelectTrigger><SelectValue placeholder="No kit" /></SelectTrigger>
              <SelectContent>
                {MOTION_PACKS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { URL.revokeObjectURL(draft.url); setDraft(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Add to Motion Kit &amp; Save</Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Library ({grouped.length})</Label>
        <div className="flex flex-col gap-2">
          {grouped.map((asset) => (
            <AssetRow key={asset.id} asset={asset} />
          ))}
          {grouped.length === 0 && (
            <p className="text-xs text-muted-foreground">No motion assets imported yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SliderField({
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
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v ?? value)} />
    </div>
  );
}

function AssetRow({ asset }: { asset: MotionAsset }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{asset.name}</span>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <Badge variant="outline" className="text-[10px]">{asset.category}</Badge>
          {asset.kitKeys.map((k) => (
            <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={asset.quality} onValueChange={(v) => updateMotionAsset(asset.id, { quality: v as MotionAssetQuality })}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MOTION_ASSET_QUALITIES.map((q) => (
              <SelectItem key={q} value={q}>{q}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={() => deleteMotionAsset(asset.id)}>
          Delete
        </Button>
      </div>
    </div>
  );
}
