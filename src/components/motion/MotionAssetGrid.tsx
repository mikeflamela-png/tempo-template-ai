/**
 * Reusable browsing grid for already-imported motion assets. Presentational
 * plus the two store calls it needs (favorite toggle, selection is lifted).
 */
import { useState } from "react";
import {
  Film,
  Image as ImageIcon,
  Music,
  Sparkles,
  Volume2,
  Heart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  assetKind,
  toggleFavorite,
  type MotionAsset,
  type MotionAssetQuality,
} from "@/lib/motion/assets";

const TIER_BADGE: Record<MotionAssetQuality, string> = {
  premium: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  core: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  supporting: "border-muted-foreground/30 bg-muted text-muted-foreground",
  experimental: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
  retired: "border-destructive/40 bg-destructive/10 text-destructive",
};

function KindIcon({ asset }: { asset: MotionAsset }) {
  const kind = assetKind(asset);
  const cls = "h-6 w-6 text-muted-foreground";
  if (kind === "video") return <Film className={cls} />;
  if (kind === "audio") return <Volume2 className={cls} />;
  if (kind === "lottie") return <Sparkles className={cls} />;
  if (kind === "svg") return <ImageIcon className={cls} />;
  return <ImageIcon className={cls} />;
}

interface MotionAssetGridProps {
  assets: MotionAsset[];
  selectedIds: Set<string> | string[];
  onToggleSelect: (id: string) => void;
  onOpen?: ((asset: MotionAsset) => void) | undefined;
}

export default function MotionAssetGrid({
  assets,
  selectedIds,
  onToggleSelect,
  onOpen,
}: MotionAssetGridProps) {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);

  if (assets.length === 0) {
    return <p className="text-xs text-muted-foreground">No motion assets imported yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {assets.map((asset) => (
        <AssetTile
          key={asset.id}
          asset={asset}
          selected={selected.has(asset.id)}
          onToggleSelect={onToggleSelect}
          {...(onOpen ? { onOpen } : {})}
        />
      ))}
    </div>
  );
}

function AssetTile({
  asset,
  selected,
  onToggleSelect,
  onOpen,
}: {
  asset: MotionAsset;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen?: ((asset: MotionAsset) => void) | undefined;
}) {
  const [hover, setHover] = useState(false);
  const kind = assetKind(asset);

  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card transition-colors",
        selected ? "border-primary ring-1 ring-primary/50" : "border-border hover:border-muted-foreground/40",
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="relative aspect-square w-full cursor-pointer bg-muted"
        onClick={() => onOpen?.(asset)}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {asset.thumb ? (
            <img src={asset.thumb} alt={asset.name} className="h-full w-full object-cover" />
          ) : kind === "video" && hover && asset.url ? (
            <video src={asset.url} autoPlay muted loop className="h-full w-full object-cover" />
          ) : (
            <KindIcon asset={asset} />
          )}
        </div>
        {kind === "video" && hover && asset.url && asset.thumb && (
          <video
            src={asset.url}
            autoPlay
            muted
            loop
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute left-1.5 top-1.5">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(asset.id)}
            onClick={(e) => e.stopPropagation()}
            className="bg-background/80"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(asset.id);
          }}
          className="absolute right-1.5 top-1.5 rounded-full bg-background/70 p-1 text-muted-foreground transition-colors hover:text-rose-400"
        >
          <Heart className={cn("h-3.5 w-3.5", asset.favorite && "fill-rose-500 text-rose-500")} />
        </button>
        <div className="absolute bottom-1.5 left-1.5">
          <Badge variant="outline" className={cn("text-[9px] uppercase", TIER_BADGE[asset.quality])}>
            {asset.quality}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-1 px-2 py-1.5">
        <span className="truncate text-xs">{asset.name}</span>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary" className="text-[9px]">{asset.role}</Badge>
          <Badge variant="outline" className="text-[9px] text-muted-foreground">
            {asset.rules.intensity}
          </Badge>
        </div>
      </div>
    </div>
  );
}
