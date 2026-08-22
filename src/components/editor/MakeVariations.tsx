import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { GitBranch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AudioTrack, TemplateSpec } from "@/lib/template/types";
import { generateFromRecipe } from "@/lib/recipe/compile";
import {
  getRecipe,
  lineageOf,
  recordVersions,
  useRecipeStore,
  versionForSpec,
} from "@/lib/recipe/store";
import { addGenerated } from "@/lib/template/store";
import { SECTION_LABEL, SECTION_ORDER, type SectionKey } from "@/lib/recipe/types";

/**
 * Branches from the CURRENT edit. Everything the recipe pins down, plus every
 * dimension the user did not tick, is inherited — only the ticked dimensions
 * are allowed to change.
 */
export function MakeVariations({
  spec,
  audio,
}: {
  spec: TemplateSpec;
  audio: AudioTrack | null;
}) {
  useRecipeStore();
  const [change, setChange] = useState<SectionKey[]>(["timing", "motion"]);
  const [distance, setDistance] = useState<"tight" | "balanced" | "wild">("balanced");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; description: string }[]>([]);
  const lineage = lineageOf(spec.id);

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      try {
        const recipe = { ...getRecipe(), variation: distance, count: 4 };
        const versions = generateFromRecipe(recipe, { audio, base: spec, change });
        addGenerated(versions.map((v) => v.spec));
        const parent = versionForSpec(spec.id);
        recordVersions(
          versions.map((v) => ({
            specId: v.spec.id,
            name: v.spec.name,
            label: v.label,
            description: v.description,
            parentId: parent?.id ?? null,
            recipeId: recipe.id,
            seed: v.seed,
            changed: change,
            spec: v.spec,
          })),
        );
        setResults(
          versions.map((v) => ({ id: v.spec.id, name: v.spec.name, description: v.description })),
        );
        toast.success("4 variations branched from this edit");
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <GitBranch className="size-3.5" /> Make variations
      </h2>
      <p className="text-[11px] text-muted-foreground">
        Keeps this edit&apos;s locked decisions. Tick only what Tempo may change.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SECTION_ORDER.map((k) => {
          const on = change.includes(k);
          return (
            <button
              key={k}
              onClick={() => setChange(on ? change.filter((c) => c !== k) : [...change, k])}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {SECTION_LABEL[k]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["tight", "balanced", "wild"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDistance(d)}
            className={`rounded-full border px-2.5 py-1 text-[11px] capitalize ${
              distance === d
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <Button size="sm" className="w-full" onClick={run} disabled={busy || change.length === 0}>
        {busy && <Loader2 className="mr-2 size-3.5 animate-spin" />} Generate 4 variations
      </Button>

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r) => (
            <Link
              key={r.id}
              to="/editor/$id"
              params={{ id: r.id }}
              className="block rounded-lg border border-border px-2.5 py-1.5 text-[11px] hover:border-primary"
            >
              <span className="block">{r.name}</span>
              <span className="block text-muted-foreground">{r.description}</span>
            </Link>
          ))}
        </div>
      )}

      {lineage.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Lineage</p>
          <ol className="mt-1 space-y-0.5">
            {lineage.map((v, i) => (
              <li key={v.id} className="truncate text-[11px] text-muted-foreground">
                {i > 0 && "↳ "}
                {v.specId === spec.id ? (
                  <span className="text-foreground">{v.name} (this edit)</span>
                ) : (
                  <Link to="/editor/$id" params={{ id: v.specId }} className="hover:underline">
                    {v.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default MakeVariations;
