/**
 * Motion Asset Import: bulk drop/pick of N files, an editable review grid of
 * drafts with auto-probed metadata + suggestions, bulk actions across
 * selected drafts, a per-draft (or bulk) usage-rules editor, inline
 * renderCompat() warnings, and a single "Import N assets" action that saves
 * everything via importMotionAsset sequentially.
 */
import { useRef, useState } from "react";
import {
  ChevronDown,
  Film,
  Heart,
  Image as ImageIcon,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOTION_PACKS } from "@/lib/motion/packs";
import { cn } from "@/lib/utils";
import {
  MOTION_ASSET_CATEGORIES,
  MOTION_ASSET_QUALITIES,
  MOTION_ASSET_ROLES,
  DEFAULT_RULES,
  assetKind,
  deleteMotionAsset,
  importMotionAsset,
  probeAsset,
  renderCompat,
  suggestIntensity,
  suggestRole,
  suggestTags,
  toggleFavorite,
  updateMotionAsset,
  useMotionAssets,
  type AssetIntensity,
  type EditSection,
  type MotionAsset,
  type MotionAssetCategory,
  type MotionAssetQuality,
  type MotionAssetRole,
  type MotionAssetRules,
} from "@/lib/motion/assets";
import MotionAssetGrid from "@/components/motion/MotionAssetGrid";

const INTENSITIES: AssetIntensity[] = ["subtle", "medium", "strong"];
const SECTIONS: EditSection[] = ["opening", "middle", "ending", "any"];

interface Props {
  previewSlot?: React.ReactNode;
}

interface Draft {
  id: string;
  file: File;
  url: string;
  probing: boolean;
  name: string;
  category: MotionAssetCategory;
  role: MotionAssetRole;
  quality: MotionAssetQuality;
  favorite: boolean;
  tags: string[];
  kitKeys: string[];
  durationSec: number;
  width?: number | undefined;
  height?: number | undefined;
  hasAlpha?: boolean | undefined;
  thumb?: string | undefined;
  rules: MotionAssetRules;
}

const uid = () => `draft-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`;

function baseDraft(file: File): Draft {
  const category = "other" as MotionAssetCategory;
  return {
    id: uid(),
    file,
    url: URL.createObjectURL(file),
    probing: true,
    name: file.name.replace(/\.[^.]+$/, ""),
    category,
    role: suggestRole(category, file.name),
    quality: "core",
    favorite: false,
    tags: suggestTags(file.name, category),
    kitKeys: [],
    durationSec: 0,
    rules: { ...DEFAULT_RULES },
  };
}

function DraftKindIcon({ draft }: { draft: Draft }) {
  const kind = assetKind({ mime: draft.file.type, fileName: draft.file.name });
  const cls = "h-6 w-6 text-muted-foreground";
  if (kind === "video") return <Film className={cls} />;
  if (kind === "audio") return <Volume2 className={cls} />;
  if (kind === "lottie") return <Sparkles className={cls} />;
  return <ImageIcon className={cls} />;
}

export default function MotionAssetImport({ previewSlot }: Props) {
  const assets = useMotionAssets();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gridSelected, setGridSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const patchDraft = (id: string, p: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d)));

  const patchSelected = (p: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (selected.has(d.id) ? { ...d, ...p } : d)));

  const patchSelectedRules = (p: Partial<MotionAssetRules>) =>
    setDrafts((ds) =>
      ds.map((d) => (selected.has(d.id) ? { ...d, rules: { ...d.rules, ...p } } : d)),
    );

  const onFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const created = list.map(baseDraft);
    setDrafts((ds) => [...created, ...ds]);
    created.forEach((d) => {
      void probeAsset(d.file).then((probe) => {
        const category = d.category; // keep "other" default; refine via inferCategory-like heuristics via role
        const durationSec = probe.duration ?? 0;
        const role = suggestRole(category, d.file.name);
        const tags = suggestTags(d.file.name, category);
        const intensity = suggestIntensity(category, durationSec);
        patchDraft(d.id, {
          probing: false,
          durationSec,
          role,
          tags,
          ...(probe.width ? { width: probe.width } : {}),
          ...(probe.height ? { height: probe.height } : {}),
          ...(probe.hasAlpha !== undefined ? { hasAlpha: probe.hasAlpha } : {}),
          ...(probe.thumb ? { thumb: probe.thumb } : {}),
          rules: { ...DEFAULT_RULES, intensity },
        });
      });
    });
  };

  const toggleDraftSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = () => setSelected(new Set(drafts.map((d) => d.id)));
  const selectNone = () => setSelected(new Set());

  const removeDrafts = (ids: Set<string>) => {
    setDrafts((ds) => {
      ds.filter((d) => ids.has(d.id)).forEach((d) => URL.revokeObjectURL(d.url));
      return ds.filter((d) => !ids.has(d.id));
    });
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleImportAll = async () => {
    if (drafts.length === 0 || importing) return;
    setImporting(true);
    setProgress(0);
    const toImport = [...drafts];
    for (let i = 0; i < toImport.length; i++) {
      const d = toImport[i]!;
      await importMotionAsset(d.file, {
        name: d.name,
        category: d.category,
        role: d.role,
        quality: d.quality,
        favorite: d.favorite,
        tags: d.tags,
        kitKeys: d.kitKeys,
        durationSec: d.durationSec,
        rules: d.rules,
        ...(d.width ? { width: d.width } : {}),
        ...(d.height ? { height: d.height } : {}),
        ...(d.hasAlpha !== undefined ? { hasAlpha: d.hasAlpha } : {}),
        ...(d.thumb ? { thumb: d.thumb } : {}),
      });
      URL.revokeObjectURL(d.url);
      setProgress(i + 1);
    }
    setDrafts([]);
    setSelected(new Set());
    setImporting(false);
    setProgress(0);
  };

  const selectedRulesSeed =
    drafts.find((d) => selected.has(d.id))?.rules ?? DEFAULT_RULES;

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
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border text-muted-foreground",
        )}
      >
        <p>Drop motion assets here or click to browse — import as many as you like</p>
        <p className="mt-1 text-xs opacity-70">
          SVG · PNG/WebP · GIF · WebM/MOV alpha · Lottie JSON · MP4 · MP3/WAV
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".svg,.png,.webp,.gif,.webm,.mov,.mp4,.json,.lottie,.mp3,.wav,video/*,image/*,audio/*,application/json"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {previewSlot}

      {drafts.length > 0 && (
        <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{drafts.length} draft{drafts.length === 1 ? "" : "s"}</span>
              <span>·</span>
              <span>{selected.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={selectAll}>Select all</Button>
              <Button size="sm" variant="ghost" onClick={selectNone}>Select none</Button>
            </div>
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
              <Select onValueChange={(v) => patchSelected({ quality: v as MotionAssetQuality })}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Set tier" /></SelectTrigger>
                <SelectContent>
                  {MOTION_ASSET_QUALITIES.map((q) => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={(v) => patchSelected({ category: v as MotionAssetCategory })}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Set category" /></SelectTrigger>
                <SelectContent>
                  {MOTION_ASSET_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={(v) => patchSelected({ role: v as MotionAssetRole })}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Set role" /></SelectTrigger>
                <SelectContent>
                  {MOTION_ASSET_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                onValueChange={(v) =>
                  setDrafts((ds) =>
                    ds.map((d) =>
                      selected.has(d.id) && !d.kitKeys.includes(v)
                        ? { ...d, kitKeys: [...d.kitKeys, v] }
                        : d,
                    ),
                  )
                }
              >
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Add to kit" /></SelectTrigger>
                <SelectContent>
                  {MOTION_PACKS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => patchSelected({ favorite: true })}
                className="gap-1"
              >
                <Heart className="h-3.5 w-3.5" /> Favorite
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeDrafts(new Set(selected))} className="gap-1 text-destructive">
                <X className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>
          )}

          {selected.size > 0 && (
            <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", rulesOpen && "rotate-180")} />
                  Usage rules for {selected.size} selected
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-border p-3 md:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Max uses</Label>
                  <Input
                    type="number"
                    min={1}
                    defaultValue={selectedRulesSeed.maxUses}
                    onChange={(e) => patchSelectedRules({ maxUses: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Min duration (s)</Label>
                  <Input
                    type="number"
                    step={0.1}
                    defaultValue={selectedRulesSeed.minDuration ?? ""}
                    onChange={(e) =>
                      patchSelectedRules({
                        minDuration: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Max duration (s)</Label>
                  <Input
                    type="number"
                    step={0.1}
                    defaultValue={selectedRulesSeed.maxDuration ?? ""}
                    onChange={(e) =>
                      patchSelectedRules({
                        maxDuration: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Intensity</Label>
                  <Select
                    defaultValue={selectedRulesSeed.intensity}
                    onValueChange={(v) => patchSelectedRules({ intensity: v as AssetIntensity })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTENSITIES.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Preferred section</Label>
                  <Select
                    defaultValue={selectedRulesSeed.preferredSection}
                    onValueChange={(v) => patchSelectedRules({ preferredSection: v as EditSection })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SECTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Avoid section</Label>
                  <Select
                    defaultValue={selectedRulesSeed.avoidSection ?? "none"}
                    onValueChange={(v) =>
                      patchSelectedRules({ avoidSection: v === "none" ? undefined : (v as EditSection) })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">none</SelectItem>
                      {SECTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-4 md:col-span-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selectedRulesSeed.mayOverlapText}
                      onCheckedChange={(v) => patchSelectedRules({ mayOverlapText: v })}
                    />
                    <Label className="text-xs">May overlap text</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selectedRulesSeed.mayOverlapProduct}
                      onCheckedChange={(v) => patchSelectedRules({ mayOverlapProduct: v })}
                    />
                    <Label className="text-xs">May overlap product</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selectedRulesSeed.mayOverlapEffect}
                      onCheckedChange={(v) => patchSelectedRules({ mayOverlapEffect: v })}
                    />
                    <Label className="text-xs">May overlap effect</Label>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {drafts.map((d) => (
              <DraftTile
                key={d.id}
                draft={d}
                selected={selected.has(d.id)}
                onToggleSelect={() => toggleDraftSelect(d.id)}
                onPatch={(p) => patchDraft(d.id, p)}
                onRemove={() => removeDrafts(new Set([d.id]))}
              />
            ))}
          </div>

          <div className="flex items-center justify-end gap-3">
            {importing && (
              <span className="text-xs text-muted-foreground">
                Importing {progress}/{drafts.length}…
              </span>
            )}
            <Button onClick={handleImportAll} disabled={importing}>
              Import {drafts.length} asset{drafts.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Library ({assets.length})
        </Label>
        <MotionAssetGrid
          assets={assets}
          selectedIds={gridSelected}
          onToggleSelect={(id) =>
            setGridSelected((s) => {
              const next = new Set(s);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
        {gridSelected.size > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">{gridSelected.size} selected</span>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-destructive"
              onClick={() => {
                gridSelected.forEach((id) => deleteMotionAsset(id));
                setGridSelected(new Set());
              }}
            >
              <X className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DraftTile({
  draft,
  selected,
  onToggleSelect,
  onPatch,
  onRemove,
}: {
  draft: Draft;
  selected: boolean;
  onToggleSelect: () => void;
  onPatch: (p: Partial<Draft>) => void;
  onRemove: () => void;
}) {
  const kind = assetKind({ mime: draft.file.type, fileName: draft.file.name });
  const compat = renderCompat({ mime: draft.file.type, fileName: draft.file.name });

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-2",
        selected ? "border-primary ring-1 ring-primary/50" : "border-border",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
        <div className="absolute inset-0 flex items-center justify-center">
          {draft.thumb ? (
            <img src={draft.thumb} alt="" className="h-full w-full object-cover" />
          ) : kind === "image" || kind === "svg" ? (
            <img src={draft.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <DraftKindIcon draft={draft} />
          )}
        </div>
        {draft.probing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-[10px] text-muted-foreground">
            probing…
          </div>
        )}
        <div className="absolute left-1.5 top-1.5">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} className="bg-background/80" />
        </div>
        <button
          type="button"
          onClick={() => onPatch({ favorite: !draft.favorite })}
          className="absolute right-1.5 top-1.5 rounded-full bg-background/70 p-1 text-muted-foreground hover:text-rose-400"
        >
          <Heart className={cn("h-3.5 w-3.5", draft.favorite && "fill-rose-500 text-rose-500")} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="absolute bottom-1.5 right-1.5 rounded-full bg-background/70 p-1 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <Input
        value={draft.name}
        onChange={(e) => onPatch({ name: e.target.value })}
        className="h-7 text-xs"
      />

      <div className="grid grid-cols-2 gap-1.5">
        <Select value={draft.category} onValueChange={(v) => onPatch({ category: v as MotionAssetCategory })}>
          <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MOTION_ASSET_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={draft.role} onValueChange={(v) => onPatch({ role: v as MotionAssetRole })}>
          <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MOTION_ASSET_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={draft.quality} onValueChange={(v) => onPatch({ quality: v as MotionAssetQuality })}>
          <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MOTION_ASSET_QUALITIES.map((q) => (
              <SelectItem key={q} value={q}>{q}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={draft.rules.intensity}
          onValueChange={(v) => onPatch({ rules: { ...draft.rules, intensity: v as AssetIntensity } })}
        >
          <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {INTENSITIES.map((i) => (
              <SelectItem key={i} value={i}>{i}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {compat.level !== "verified" && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-1 text-[10px] leading-tight text-amber-300">
          {compat.note}
        </p>
      )}
    </div>
  );
}
