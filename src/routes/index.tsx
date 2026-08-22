import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { PreviewReelControl } from "@/components/PreviewReelControl";
import { TemplateCard } from "@/components/TemplateCard";
import { Chips, Field, RecipeSection } from "@/components/recipe/RecipeSection";
import {
  SECTION_LABEL,
  SECTION_ORDER,
  STRUCTURES,
  type ControlState,
  type SectionKey,
} from "@/lib/recipe/types";
import {
  patchSection,
  patchSectionValue,
  recordVersions,
  resetRecipe,
  saveRecipeAs,
  loadRecipe,
  deleteSavedRecipe,
  updateRecipe,
  useRecipeStore,
} from "@/lib/recipe/store";
import { generateFromRecipe, recipeSummary, tempoWillDecide } from "@/lib/recipe/compile";
import { addGenerated, useTemplateStore } from "@/lib/template/store";
import { SIMPLE_STYLES } from "@/lib/template/simplestyles";
import { FONTS } from "@/lib/template/fonts";
import { useBrandStore } from "@/lib/brand/store";
import { useMotionAssets } from "@/lib/motion/assets";
import { allBlueprints } from "@/lib/blueprint/library";
import { analyseAudio } from "@/lib/audio/beatmap";
import { setAudio } from "@/lib/template/store";
import type { TemplateSpec } from "@/lib/template/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tempo — a controlled video variation engine" },
      {
        name: "description",
        content:
          "Build a creative recipe — footage, structure, timing, copy, type, style, motion and music — then generate four variations that all respect your decisions.",
      },
      { property: "og:title", content: "Tempo — controlled video variation" },
      {
        property: "og:description",
        content:
          "Decide what matters, let Tempo vary the rest. Four edits per recipe, all within your constraints.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecipeBuilder,
});

const DURATIONS = [6, 8, 10, 15, 20, 30];
const PACINGS = ["slow", "medium", "fast", "dynamic"] as const;
const SHOT_LENGTHS = ["micro", "short", "medium", "long"] as const;
const SHOT_LABELS = {
  micro: "Micro (0.4s)",
  short: "Short (0.8s)",
  medium: "Medium (1.4s)",
  long: "Long (2.4s)",
};
const COPY_FIELDS = [
  ["hook", "Hook"],
  ["headline", "Headline"],
  ["feature", "Feature"],
  ["support", "Support"],
  ["offer", "Offer"],
  ["cta", "CTA"],
] as const;

function RecipeBuilder() {
  const { recipe, saved: savedRecipes } = useRecipeStore();
  const { reel, audio } = useTemplateStore();
  const { kits, copyKits } = useBrandStore();
  const assets = useMotionAssets();
  const blueprints = useMemo(() => allBlueprints(), []);
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<TemplateSpec[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [analysing, setAnalysing] = useState(false);

  const summary = recipeSummary(recipe);
  const decide = tempoWillDecide(recipe);

  const sectionProps = (key: SectionKey, index: number, hint: string, summaryText: string) => ({
    index,
    title: SECTION_LABEL[key],
    hint,
    summary: summaryText,
    state: recipe[key].state,
    locked: recipe[key].locked,
    onState: (s: ControlState) => patchSection(key, { state: s } as never),
    onLocked: (v: boolean) => patchSection(key, { locked: v } as never),
  });

  const generate = () => {
    if (busy) return;
    setBusy(true);
    setTimeout(() => {
      try {
        const versions = generateFromRecipe(recipe, { audio });
        addGenerated(versions.map((v) => v.spec));
        recordVersions(
          versions.map((v) => ({
            specId: v.spec.id,
            name: v.spec.name,
            label: v.label,
            description: v.description,
            parentId: null,
            recipeId: recipe.id,
            seed: v.seed,
            changed: SECTION_ORDER,
            spec: v.spec,
          })),
        );
        setResults(versions.map((v) => v.spec));
        setDescriptions(Object.fromEntries(versions.map((v) => [v.spec.id, v.description])));
        toast(`${versions.length} versions generated`, {
          description: "All four respect every decision you locked in.",
        });
      } catch (err) {
        toast("Generation failed", { description: (err as Error).message });
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const uploadMusic = async (file?: File | null) => {
    if (!file) return;
    setAnalysing(true);
    try {
      const { beatMap } = await analyseAudio(file);
      setAudio({
        url: URL.createObjectURL(file),
        name: file.name,
        duration: beatMap.duration,
        trimStart: recipe.music.value.startAt,
        volume: 0.8,
        fadeIn: 0.2,
        fadeOut: 0.5,
        beatMap,
      });
      toast("Track analysed", { description: `${Math.round(beatMap.bpm)} BPM` });
    } catch {
      toast("Couldn't analyse that track");
    } finally {
      setAnalysing(false);
    }
  };

  const t = recipe.timing.value;
  const cp = recipe.copy.value;
  const ty = recipe.type.value;
  const mo = recipe.motion.value;
  const mu = recipe.music.value;
  const fi = recipe.finish.value;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 pb-24">
        <header className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Creative recipe
          </p>
          <h1 className="display-tight mt-2 text-4xl tracking-tight">
            Decide what matters.
            <br />
            <span className="text-muted-foreground">Tempo varies the rest.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Everything you choose is a hard constraint. Everything left on Auto becomes a variation
            dimension across four versions.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              to="/advanced"
              className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              Advanced generator →
            </Link>
          </div>
        </header>

        <Textarea
          value={recipe.brief}
          onChange={(e) => updateRecipe({ brief: e.target.value })}
          rows={2}
          placeholder="Optional brief — what is this video for? (e.g. premium running shoe, energetic but clean)"
          className="mb-6 resize-none rounded-2xl border-border bg-card/40 text-sm"
        />

        <div className="space-y-3">
          {/* 01 FOOTAGE */}
          <RecipeSection
            {...sectionProps(
              "footage",
              1,
              "Tempo picks the strongest sections of your stringout",
              reel
                ? `${reel.name} · ${reel.duration.toFixed(0)}s${
                    recipe.footage.value.regions.length
                      ? ` · ${recipe.footage.value.regions.length} regions`
                      : ""
                  }`
                : "No stringout uploaded yet",
            )}
            allowSurprise={false}
            defaultOpen={!reel}
          >
            <PreviewReelControl />
            <Field label="Preferred / excluded moments (seconds)">
              <div className="space-y-2">
                {recipe.footage.value.regions.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={r.kind}
                      onChange={(e) => {
                        const regions = [...recipe.footage.value.regions];
                        regions[i] = { ...r, kind: e.target.value as typeof r.kind };
                        patchSectionValue("footage", { regions });
                      }}
                      className="h-9 rounded-lg border border-border bg-card px-2 text-xs"
                    >
                      <option value="prefer">Prefer</option>
                      <option value="lock">Lock</option>
                      <option value="exclude">Exclude</option>
                    </select>
                    {(["from", "to"] as const).map((k) => (
                      <Input
                        key={k}
                        type="number"
                        step="0.1"
                        value={r[k]}
                        onChange={(e) => {
                          const regions = [...recipe.footage.value.regions];
                          regions[i] = { ...r, [k]: Number(e.target.value) };
                          patchSectionValue("footage", { regions });
                        }}
                        className="h-9 w-24 text-xs"
                      />
                    ))}
                    <button
                      onClick={() =>
                        patchSectionValue("footage", {
                          regions: recipe.footage.value.regions.filter((_, j) => j !== i),
                        })
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patchSectionValue("footage", {
                      regions: [
                        ...recipe.footage.value.regions,
                        { from: 0, to: Math.min(5, reel?.duration ?? 5), kind: "prefer" as const },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 size-3.5" /> Add region
                </Button>
              </div>
            </Field>
          </RecipeSection>

          {/* 02 STRUCTURE */}
          <RecipeSection
            {...sectionProps(
              "structure",
              2,
              "Tempo chooses the edit structure",
              recipe.structure.value.structureKey
                ? STRUCTURES.find((s) => s.key === recipe.structure.value.structureKey)?.label ?? ""
                : "Auto structure",
            )}
          >
            <Field label="Structure">
              <Chips
                options={STRUCTURES.map((s) => s.key)}
                value={recipe.structure.value.structureKey}
                labels={Object.fromEntries(STRUCTURES.map((s) => [s.key, s.label]))}
                onChange={(structureKey) => patchSectionValue("structure", { structureKey })}
              />
            </Field>
            <Field label="Blueprint (optional)">
              <select
                value={recipe.structure.value.blueprintId ?? ""}
                onChange={(e) =>
                  patchSectionValue("structure", { blueprintId: e.target.value || null })
                }
                className="h-9 w-full rounded-lg border border-border bg-card px-2 text-xs"
              >
                <option value="">Let Tempo choose</option>
                {blueprints.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </RecipeSection>

          {/* 03 TIMING */}
          <RecipeSection
            {...sectionProps(
              "timing",
              3,
              "Tempo sets pacing and shot lengths",
              `${t.duration}s${t.pacing ? ` · ${t.pacing}` : ""}${t.shotLength ? ` · ${t.shotLength} shots` : ""}`,
            )}
          >
            <Field label="Duration">
              <Chips
                options={DURATIONS}
                value={t.duration}
                suffix="s"
                onChange={(duration) => patchSectionValue("timing", { duration })}
              />
            </Field>
            <Field label="Pacing">
              <Chips
                options={PACINGS}
                value={t.pacing}
                onChange={(pacing) => patchSectionValue("timing", { pacing })}
              />
            </Field>
            <Field label="Shot length">
              <Chips
                options={SHOT_LENGTHS}
                value={t.shotLength}
                labels={SHOT_LABELS}
                onChange={(shotLength) => patchSectionValue("timing", { shotLength })}
              />
            </Field>
          </RecipeSection>

          {/* 04 COPY */}
          <RecipeSection
            {...sectionProps(
              "copy",
              4,
              "Tempo writes and places the copy",
              cp.mode === "exact"
                ? `Exact copy · ${Object.values(cp.lines).filter(Boolean).length} lines`
                : cp.mode === "none"
                  ? "No copy"
                  : "Auto copy",
            )}
          >
            <Field label="Copy mode">
              <Chips
                options={["auto", "none", "exact", "assisted"] as const}
                value={cp.mode}
                labels={{
                  auto: "Tempo writes it",
                  none: "No copy",
                  exact: "Exact copy (preserved)",
                  assisted: "Assisted",
                }}
                onChange={(mode) => patchSectionValue("copy", { mode })}
              />
            </Field>
            {cp.mode !== "none" && cp.mode !== "auto" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {COPY_FIELDS.map(([key, label]) => (
                  <Input
                    key={key}
                    value={cp.lines[key]}
                    placeholder={label}
                    onChange={(e) =>
                      patchSectionValue("copy", { lines: { ...cp.lines, [key]: e.target.value } })
                    }
                    className="h-9 text-xs"
                  />
                ))}
              </div>
            )}
            {copyKits.length > 0 && (
              <Field label="Copy kit">
                <select
                  value={recipe.copyKitId ?? ""}
                  onChange={(e) => updateRecipe({ copyKitId: e.target.value || null })}
                  className="h-9 w-full rounded-lg border border-border bg-card px-2 text-xs"
                >
                  <option value="">None</option>
                  {copyKits.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </RecipeSection>

          {/* 05 TYPE */}
          <RecipeSection
            {...sectionProps(
              "type",
              5,
              "Tempo chooses the typography treatment",
              ty.useBrandKit
                ? "Brand kit typography"
                : ty.fontKey
                  ? `${FONTS.find((f) => f.key === ty.fontKey)?.name ?? ty.fontKey}${ty.uppercase ? " · uppercase" : ""}`
                  : "Auto typography",
            )}
          >
            <Field label="Source">
              <Chips
                options={["brand", "custom"] as const}
                value={ty.useBrandKit ? "brand" : "custom"}
                labels={{ brand: "Brand kit", custom: "Choose a font" }}
                onChange={(v) => patchSectionValue("type", { useBrandKit: v === "brand" })}
              />
            </Field>
            {ty.useBrandKit ? (
              <Field label="Brand kit">
                <select
                  value={recipe.brandId ?? ""}
                  onChange={(e) => updateRecipe({ brandId: e.target.value || null })}
                  className="h-9 w-full rounded-lg border border-border bg-card px-2 text-xs"
                >
                  <option value="">Select a brand kit</option>
                  {kits.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Font">
                <select
                  value={ty.fontKey ?? ""}
                  onChange={(e) => patchSectionValue("type", { fontKey: e.target.value || null })}
                  className="h-9 w-full rounded-lg border border-border bg-card px-2 text-xs"
                >
                  <option value="">Let Tempo choose</option>
                  {FONTS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.name} — {f.category}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Position">
                <Chips
                  options={["top", "center", "bottom"] as const}
                  value={ty.position}
                  onChange={(position) => patchSectionValue("type", { position })}
                />
              </Field>
              <Field label="Align">
                <Chips
                  options={["left", "center", "right"] as const}
                  value={ty.align}
                  onChange={(align) => patchSectionValue("type", { align })}
                />
              </Field>
            </div>
            <Field label="Text motion">
              <Chips
                options={["static", "subtle", "kinetic", "aggressive"] as const}
                value={ty.motion}
                onChange={(motion) => patchSectionValue("type", { motion })}
              />
            </Field>
            <Field label={`Size ${(ty.sizeScale ?? 1).toFixed(2)}×`}>
              <Slider
                min={0.6}
                max={1.8}
                step={0.05}
                value={[ty.sizeScale ?? 1]}
                onValueChange={([v]) => patchSectionValue("type", { sizeScale: v ?? 1 })}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={ty.uppercase ?? false}
                onChange={(e) => patchSectionValue("type", { uppercase: e.target.checked })}
              />
              Force uppercase
            </label>
          </RecipeSection>

          {/* 06 STYLE */}
          <RecipeSection
            {...sectionProps(
              "style",
              6,
              "Tempo chooses the treatment",
              SIMPLE_STYLES.find((s) => s.key === recipe.style.value.styleKey)?.name ?? "Auto style",
            )}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {SIMPLE_STYLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => patchSectionValue("style", { styleKey: s.key })}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    recipe.style.value.styleKey === s.key
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <p className="text-sm">{s.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{s.blurb}</p>
                </button>
              ))}
            </div>
          </RecipeSection>

          {/* 07 MOTION */}
          <RecipeSection
            {...sectionProps(
              "motion",
              7,
              "Tempo places motion and graphics",
              mo.assetIds.length
                ? `${mo.assetIds.length} assets · ${mo.frequency}`
                : "Auto motion",
            )}
          >
            {assets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No imported motion assets yet —{" "}
                <Link to="/library" className="underline">
                  import some in the library
                </Link>
                . Tempo will use its native effects meanwhile.
              </p>
            ) : (
              <Field label="Use these assets">
                <div className="flex flex-wrap gap-2">
                  {assets.map((a) => {
                    const on = mo.assetIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() =>
                          patchSectionValue("motion", {
                            assetIds: on
                              ? mo.assetIds.filter((id) => id !== a.id)
                              : [...mo.assetIds, a.id],
                          })
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}
            <Field label="Frequency">
              <Chips
                options={["once", "occasionally", "often"] as const}
                value={mo.frequency}
                onChange={(frequency) => patchSectionValue("motion", { frequency })}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={mo.supporting}
                onChange={(e) => patchSectionValue("motion", { supporting: e.target.checked })}
              />
              Tempo may add supporting effects
            </label>
          </RecipeSection>

          {/* 08 MUSIC */}
          <RecipeSection
            {...sectionProps(
              "music",
              8,
              "Tempo edits without a track",
              audio ? `${audio.name} · ${mu.beatSync} sync` : "No track uploaded",
            )}
            allowSurprise={false}
          >
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-xs hover:border-foreground/40">
                {analysing ? "Analysing…" : audio ? "Replace track" : "Upload track"}
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => void uploadMusic(e.target.files?.[0])}
                />
              </label>
              {audio?.beatMap && (
                <span className="text-xs text-muted-foreground">
                  {Math.round(audio.beatMap.bpm)} BPM · {audio.beatMap.events.length} events
                </span>
              )}
            </div>
            <Field label="Beat sync">
              <Chips
                options={["off", "loose", "medium", "strong"] as const}
                value={mu.beatSync}
                onChange={(beatSync) => patchSectionValue("music", { beatSync })}
              />
            </Field>
            <Field label="Sync applies to">
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    ["majorCuts", "Major cuts"],
                    ["motionHits", "Motion hits"],
                    ["textHits", "Text hits"],
                    ["heroReveal", "Hero reveal"],
                    ["ending", "Ending"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={mu.uses[k]}
                      onChange={(e) =>
                        patchSectionValue("music", { uses: { ...mu.uses, [k]: e.target.checked } })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
          </RecipeSection>

          {/* 09 FINISH */}
          <RecipeSection
            {...sectionProps(
              "finish",
              9,
              "Tempo decides intensity and ending",
              `Intensity ${fi.intensity} · ${fi.polish}${fi.ending ? ` · ${fi.ending.replace(/_/g, " ")}` : ""}`,
            )}
          >
            {(
              [
                ["intensity", "Overall intensity"],
                ["effectDensity", "Effect density"],
                ["footagePriority", "Graphics vs footage"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={`${label} — ${fi[k]}`}>
                <Slider
                  min={0}
                  max={10}
                  step={1}
                  value={[fi[k]]}
                  onValueChange={([v]) => patchSectionValue("finish", { [k]: v ?? 0 })}
                />
              </Field>
            ))}
            <Field label="Polish">
              <Chips
                options={["clean", "textured", "raw"] as const}
                value={fi.polish}
                onChange={(polish) => patchSectionValue("finish", { polish })}
              />
            </Field>
            <Field label="Ending">
              <Chips
                options={["hero_hold", "logo", "cta", "end_card", "lifestyle"] as const}
                value={fi.ending}
                labels={{
                  hero_hold: "Hero hold",
                  logo: "Logo",
                  cta: "CTA",
                  end_card: "End card",
                  lifestyle: "Lifestyle fade",
                }}
                onChange={(ending) => patchSectionValue("finish", { ending })}
              />
            </Field>
          </RecipeSection>
        </div>

        {/* GENERATE */}
        <div className="mt-8 rounded-2xl border border-primary/30 bg-card/60 p-5">
          <div className="flex flex-wrap gap-2">
            {summary.map((s) => (
              <span
                key={s}
                className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] text-foreground"
              >
                {s}
              </span>
            ))}
          </div>
          {decide.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Tempo will decide
              </p>
              <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                {decide.map((d) => (
                  <li key={d}>· {d}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Chips
              options={[2, 4, 6]}
              value={recipe.count}
              suffix=" versions"
              onChange={(count) => updateRecipe({ count })}
            />
            <Chips
              options={["tight", "balanced", "wild"] as const}
              value={recipe.variation}
              onChange={(variation) => updateRecipe({ variation })}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={recipe.strict}
                onChange={(e) => updateRecipe({ strict: e.target.checked })}
              />
              Strict recipe (nothing unselected)
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={generate} disabled={busy} size="lg" className="rounded-full">
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              Generate {recipe.count} versions
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                const name = window.prompt("Name this recipe", recipe.name) ?? "";
                if (name) {
                  saveRecipeAs(name);
                  toast("Recipe saved");
                }
              }}
            >
              Save recipe
            </Button>
            <Button
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                resetRecipe();
                setResults([]);
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        {savedRecipes.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Saved recipes
            </p>
            {savedRecipes.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card/30 px-4 py-2"
              >
                <button className="text-sm hover:underline" onClick={() => loadRecipe(r.id)}>
                  {r.name}
                </button>
                <button
                  onClick={() => deleteSavedRecipe(r.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <section className="mt-12">
            <h2 className="display-tight text-lg uppercase tracking-[0.2em]">Versions</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              {results.map((spec) => (
                <div key={spec.id} className="space-y-2">
                  <TemplateCard spec={spec} />
                  <p className="text-xs text-muted-foreground">{descriptions[spec.id]}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void navigate({ to: "/editor/$id", params: { id: spec.id } })}
                  >
                    Refine this edit
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
