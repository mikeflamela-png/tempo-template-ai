/**
 * VARIATION MATRIX
 *
 * Pick dimensions + a count per dimension, generate the cross product of
 * real spec variants, preview each in the existing Remotion player and see
 * exactly what changed. Also hosts Keep/Change ("make another like this").
 */
import { useMemo, useState } from "react";
import type { AudioTrack, MediaMap, TemplateSpec } from "@/lib/template/types";
import { TemplatePlayer } from "@/components/video/TemplatePlayer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DIMENSION_LABEL,
  VARIATION_DIMENSIONS,
  buildVariations,
  keepChangeVariant,
  type VariationDimension,
} from "@/lib/creative/variations";
import { creativeDiff } from "@/lib/creative/diff";
import { addGenerated } from "@/lib/template/store";
import type { BrandKit, CopyKit } from "@/lib/brand/store";

export interface VariationMatrixProps {
  base: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
  audio?: AudioTrack | null;
  brand?: BrandKit | null;
  copy?: CopyKit | null;
  blueprintIds?: string[];
  onSelect?: (spec: TemplateSpec) => void;
}

export default function VariationMatrix({
  base,
  media,
  textOverrides,
  audio = null,
  brand = null,
  copy = null,
  blueprintIds,
  onSelect,
}: VariationMatrixProps) {
  const [selectedDims, setSelectedDims] = useState<Set<VariationDimension>>(
    () => new Set<VariationDimension>(["hook", "cta"]),
  );
  const [counts, setCounts] = useState<Partial<Record<VariationDimension, number>>>({
    hook: 2,
    cta: 2,
  });
  const [variants, setVariants] = useState<TemplateSpec[]>([]);
  const [keep, setKeep] = useState<Partial<Record<VariationDimension, boolean>>>({});
  const [keepVariant, setKeepVariant] = useState<TemplateSpec | null>(null);

  const dims = useMemo(() => Array.from(selectedDims), [selectedDims]);

  function toggleDim(dim: VariationDimension) {
    setSelectedDims((prev) => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim);
      else {
        next.add(dim);
        setCounts((c) => ({ ...c, [dim]: c[dim] ?? 2 }));
      }
      return next;
    });
  }

  function setCount(dim: VariationDimension, n: number) {
    setCounts((c) => ({ ...c, [dim]: Math.max(1, Math.min(4, n)) }));
  }

  function createVariations() {
    if (!dims.length) return;
    const generated = buildVariations(base, {
      dimensions: dims,
      counts,
      brand,
      copy,
      blueprintIds,
      seed: Math.floor(Math.random() * 1e9),
    });
    setVariants(generated);
    addGenerated(generated);
  }

  function makeAnotherLikeThis() {
    const next = keepChangeVariant(base, keep, { brand, copy, blueprintIds });
    setKeepVariant(next);
    addGenerated([next]);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Variation Matrix</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {VARIATION_DIMENSIONS.map((dim) => {
            const on = selectedDims.has(dim);
            return (
              <div key={dim} className="flex items-center gap-2 rounded-md border border-border p-2">
                <Checkbox
                  id={`dim-${dim}`}
                  checked={on}
                  onCheckedChange={() => toggleDim(dim)}
                />
                <Label htmlFor={`dim-${dim}`} className="flex-1 cursor-pointer text-xs">
                  {DIMENSION_LABEL[dim]}
                </Label>
                {on && (
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={counts[dim] ?? 2}
                    onChange={(e) => setCount(dim, Number(e.target.value) || 1)}
                    className="h-7 w-12 px-1 text-xs"
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {dims.length
              ? `Will generate up to ${Math.min(
                  16,
                  dims.reduce((acc, d) => acc * Math.max(1, counts[d] ?? 1), 1),
                )} variants.`
              : "Select at least one dimension."}
          </p>
          <Button size="sm" disabled={!dims.length} onClick={createVariations}>
            Create Variations
          </Button>
        </div>
      </Card>

      {variants.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {variants.map((v) => (
            <VariantCard
              key={v.id}
              spec={v}
              base={base}
              media={media}
              textOverrides={textOverrides}
              audio={audio}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Keep / Change</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Check the dimensions to keep exactly as-is; unchecked dimensions regenerate.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {VARIATION_DIMENSIONS.map((dim) => (
            <div key={dim} className="flex items-center gap-2">
              <Checkbox
                id={`keep-${dim}`}
                checked={!!keep[dim]}
                onCheckedChange={(c) => setKeep((k) => ({ ...k, [dim]: !!c }))}
              />
              <Label htmlFor={`keep-${dim}`} className="cursor-pointer text-xs">
                {DIMENSION_LABEL[dim]}
              </Label>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button size="sm" variant="secondary" onClick={makeAnotherLikeThis}>
            Make another like this
          </Button>
        </div>
        {keepVariant && (
          <div className="mt-4 max-w-sm">
            <VariantCard
              spec={keepVariant}
              base={base}
              media={media}
              textOverrides={textOverrides}
              audio={audio}
              onSelect={onSelect}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function VariantCard({
  spec,
  base,
  media,
  textOverrides,
  audio,
  onSelect,
}: {
  spec: TemplateSpec;
  base: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
  audio?: AudioTrack | null;
  onSelect?: (spec: TemplateSpec) => void;
}) {
  const diff = useMemo(() => creativeDiff(base, spec), [base, spec]);
  const changed = diff.filter((d) => d.change === "changed");

  return (
    <Card className="flex flex-col overflow-hidden p-2">
      <div
        className="mx-auto w-full max-w-[220px] overflow-hidden rounded-md bg-black"
        style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
      >
        <TemplatePlayer
          spec={spec}
          media={media}
          textOverrides={textOverrides}
          audio={audio}
          controls={false}
          autoPlay={false}
          loop
          clickToPlay
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="secondary" className="text-[10px]">
          {spec.versionLabel ?? "variant"}
        </Badge>
      </div>
      <div className="mt-2 max-h-28 overflow-y-auto text-[11px] leading-snug text-muted-foreground">
        {changed.length === 0 ? (
          <p>No differences from base.</p>
        ) : (
          <ul className="list-disc pl-4">
            {changed.map((d) => (
              <li key={d.label}>
                <span className="font-medium text-foreground">{d.label}:</span> {d.detail}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button size="sm" className="mt-2" onClick={() => onSelect?.(spec)}>
        Use this variant
      </Button>
    </Card>
  );
}
