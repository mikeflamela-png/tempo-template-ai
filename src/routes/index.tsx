import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TemplateCard } from "@/components/TemplateCard";
import { PreviewReelControl } from "@/components/PreviewReelControl";
import { Slider } from "@/components/ui/slider";
import { BASE_TEMPLATES } from "@/lib/template/library";
import {
  COMPLEXITIES,
  DURATIONS,
  ENERGIES,
  FORMATS,
  PLATFORMS,
  AESTHETICS,
  PACINGS,
  TYPOGRAPHY_LEVELS,
  TRANSITION_INTENSITIES,
  LAYOUT_COMPLEXITIES,
  generateTemplates,
  regenerateSimilar,
  remixTemplate,
  type GenerateOptions,
} from "@/lib/template/generate";
import { addGenerated, useTemplateStore } from "@/lib/template/store";
import { STYLE_PACKS, applyStylePack, stylePackByKey } from "@/lib/template/stylepacks";
import { syncSpecToTrack } from "@/lib/template/sync";
import { useBrandStore, brandById, copyKitById, fontWarnings } from "@/lib/brand/store";
import { applyBrand } from "@/lib/brand/apply";
import { applyTypeSystems, typeSystemsForBrand } from "@/lib/brand/typesystems";
import { appendEndCard, endCardsForBrand } from "@/lib/brand/endcards";
import { rankByTaste } from "@/lib/taste/profile";
import { MOTION_PACKS, packByKey, applyMotionPack } from "@/lib/motion/packs";
import { allBlueprints, blueprintById, applyBlueprint, useBlueprints } from "@/lib/blueprint/library";
import { Link } from "@tanstack/react-router";
import type { TemplateSpec } from "@/lib/template/types";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tempo — generate short-form video editing templates" },
      {
        name: "description",
        content:
          "Describe the video you want, generate animated short-form editing templates, then drop your own clips into the slots.",
      },
      { property: "og:title", content: "Tempo" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Generate animated short-form editing templates and swap in your own media.",
      },
    ],
  }),
  component: Index,
});

const EXAMPLE =
  "Create a punchy 10-second footwear ad for Instagram Reels. Premium but energetic. Fast opening, interesting transitions, minimal typography, strong product ending.";

const CATEGORIES = [
  "All",
  "Saved",
  "Footwear",
  "Fashion",
  "Outdoor",
  "Beverage",
  "Beauty",
  "Product",
  "Lifestyle",
  "Performance Ads",
];

function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  suffix,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o)}
            onClick={() => onChange(o)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              o === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {String(o)}
            {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      {...(title ? { title } : {})}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Index() {

  const { generated, saved, audio } = useTemplateStore();
  const [packKey, setPackKey] = useState<string | null>(null);
  const [musicFirst, setMusicFirst] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState(PLATFORMS[0]!);
  const [duration, setDuration] = useState(10);
  const [format, setFormat] = useState(FORMATS[0]!);
  const [energy, setEnergy] = useState(ENERGIES[2]!);
  const [complexity, setComplexity] = useState(COMPLEXITIES[1]!);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("All");
  const [aesthetic, setAesthetic] = useState(AESTHETICS[0]!);
  const [pacing, setPacing] = useState(PACINGS[1]!);
  const [typography, setTypography] = useState(TYPOGRAPHY_LEVELS[2]!);
  const [transitionIntensity, setTransitionIntensity] = useState(TRANSITION_INTENSITIES[2]!);
  const [layoutComplexity, setLayoutComplexity] = useState(LAYOUT_COMPLEXITIES[1]!);
  const [risk, setRisk] = useState(4);
  const [showMore, setShowMore] = useState(false);
  const brand = useBrandStore();
  useBlueprints();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [motionKey, setMotionKey] = useState<string | null>(null);
  const [effectAmount, setEffectAmount] = useState(5);

  const activeBrand = brandById(brandId ?? brand.activeKitId);
  const activeCopy = copyKitById(copyId ?? brand.activeCopyId);
  const warnings = fontWarnings(activeBrand);
  const blueprints = allBlueprints();

  const opts: GenerateOptions = {
    prompt,
    platform,
    duration,
    format,
    energy,
    complexity,
    aesthetic,
    pacing,
    typography,
    transitionIntensity,
    layoutComplexity,
    risk,
  };

  const finish = (specs: TemplateSpec[]) => {
    const pack = stylePackByKey(packKey);
    const blueprint = blueprintById(blueprintId);
    const motion = packByKey(motionKey);
    let out = specs.map((s) => {
      let spec = pack ? applyStylePack(s, pack) : s;
      spec = applyBlueprint(spec, blueprint);
      spec = applyMotionPack(spec, motion, effectAmount);
      spec = applyBrand(spec, activeBrand, activeCopy);
      if (activeBrand) {
        const systems = typeSystemsForBrand(activeBrand.id);
        if (systems.length) spec = applyTypeSystems(spec, systems);
        const card = endCardsForBrand(activeBrand.id)[0];
        if (card) spec = appendEndCard(spec, card, activeBrand);
      }
      return spec;
    });
    if (musicFirst && audio?.beatMap) out = out.map((s) => syncSpecToTrack(s, audio, 0.7));
    // Learned taste decides which of the candidates lead.
    out = rankByTaste(out, (s, w) => {
      const shots = s.mediaSlots.length || 1;
      const avgShot = s.duration / shots;
      const shotFit = 1 - Math.min(1, Math.abs(avgShot - (2.4 - w.pacing * 1.8)) / 2);
      const textFit = 1 - Math.min(1, Math.abs(s.textSlots.length / shots - w.typographyDensity));
      const fxFit =
        1 - Math.min(1, Math.abs((s.creativeEvents ?? []).length / shots - w.effectDensity));
      return (shotFit + textFit + fxFit) / 3;
    });
    return out;
  };


  const generate = () => {
    setBusy(true);
    setTimeout(() => {
      addGenerated(finish(generateTemplates({ ...opts, prompt: prompt || EXAMPLE }, 4)));
      setBusy(false);
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
    }, 450);
  };

  const similar = (spec: TemplateSpec) => {
    addGenerated(finish(regenerateSimilar(spec, { ...opts, prompt: prompt || EXAMPLE }, 4)));
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
  };

  const remix = (spec: TemplateSpec) => {
    addGenerated(finish(remixTemplate(spec, { ...opts, prompt: prompt || EXAMPLE }, 4)));
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
  };

  const library = useMemo(() => {
    if (category === "All") return BASE_TEMPLATES;
    if (category === "Saved")
      return [...generated, ...BASE_TEMPLATES].filter((t) => saved.includes(t.id));
    return BASE_TEMPLATES.filter((t) => t.tags.includes(category));
  }, [category, generated, saved]);

  return (
    <main className="min-h-screen">
      <div className="glow-surface">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="display-tight text-lg tracking-tight">
            TEM<span className="text-primary">PO</span>
          </span>
          <div className="flex items-center gap-4">
            <Link
              to="/brand"
              className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              Brand kit
            </Link>
            <Link
              to="/library"
              className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              Creative library
            </Link>

            <PreviewReelControl compact />
          </div>
        </header>

        <section className="mx-auto max-w-3xl px-6 pb-16 pt-10 text-center">
          <h1 className="display-tight text-5xl sm:text-7xl">What do you want to make?</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground">
            Describe the video. We design the edit — cuts, transitions, layouts and typography —
            then you drop your own footage into the slots.
          </p>

          <div className="mt-10 rounded-3xl border border-border bg-card/70 p-4 text-left backdrop-blur">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={EXAMPLE}
              className="min-h-28 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            />
            <div className="mt-4 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
              <Chips label="Platform" options={PLATFORMS} value={platform} onChange={setPlatform} />
              <Chips label="Duration" options={DURATIONS} value={duration} onChange={setDuration} suffix="s" />
              <Chips label="Format" options={FORMATS} value={format} onChange={setFormat} />
              <Chips label="Energy" options={ENERGIES} value={energy} onChange={setEnergy} />
              <div className="sm:col-span-2">
                <Chips
                  label="Template complexity"
                  options={COMPLEXITIES}
                  value={complexity}
                  onChange={setComplexity}
                />
              </div>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <button
                onClick={() => setShowMore((v) => !v)}
                className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
              >
                {showMore ? "− Hide direction controls" : "+ Direction controls"}
              </button>
              {showMore && (
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Chips label="Aesthetic" options={AESTHETICS} value={aesthetic} onChange={setAesthetic} />
                  </div>
                  <Chips label="Pacing" options={PACINGS} value={pacing} onChange={setPacing} />
                  <Chips label="Typography" options={TYPOGRAPHY_LEVELS} value={typography} onChange={setTypography} />
                  <Chips
                    label="Transition intensity"
                    options={TRANSITION_INTENSITIES}
                    value={transitionIntensity}
                    onChange={setTransitionIntensity}
                  />
                  <Chips
                    label="Layout complexity"
                    options={LAYOUT_COMPLEXITIES}
                    value={layoutComplexity}
                    onChange={setLayoutComplexity}
                  />
                  <div className="sm:col-span-2 space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Creative risk
                    </p>
                    <Slider value={[risk]} min={1} max={10} step={1} onValueChange={(v) => setRisk(v[0] ?? 4)} />
                    <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <span>Safe</span>
                      <span>Weird</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Brand kit
                </p>
                <div className="flex flex-wrap gap-2">
                  <Pill active={!activeBrand} onClick={() => setBrandId(null)}>
                    None
                  </Pill>
                  {brand.kits.map((k) => (
                    <Pill key={k.id} active={activeBrand?.id === k.id} onClick={() => setBrandId(k.id)}>
                      {k.name}
                    </Pill>
                  ))}
                  <Link
                    to="/brand"
                    className="rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    + Manage
                  </Link>
                </div>
                {warnings.map((w) => (
                  <p key={w} className="text-xs text-destructive">
                    {w}
                  </p>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Copy kit
                </p>
                <div className="flex flex-wrap gap-2">
                  <Pill active={!activeCopy} onClick={() => setCopyId(null)}>
                    Placeholder copy
                  </Pill>
                  {brand.copyKits.map((c) => (
                    <Pill key={c.id} active={activeCopy?.id === c.id} onClick={() => setCopyId(c.id)}>
                      {c.name} · {c.mode}
                    </Pill>
                  ))}
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Blueprint
                </p>
                <div className="flex flex-wrap gap-2">
                  <Pill active={!blueprintId} onClick={() => setBlueprintId(null)}>
                    Let Tempo decide
                  </Pill>
                  {blueprints.map((b) => (
                    <Pill
                      key={b.id}
                      active={blueprintId === b.id}
                      onClick={() => setBlueprintId(b.id)}
                      title={b.blurb}
                    >
                      {b.name}
                    </Pill>
                  ))}
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Motion kit
                </p>
                <div className="flex flex-wrap gap-2">
                  <Pill active={!motionKey} onClick={() => setMotionKey(null)}>
                    Mixed
                  </Pill>
                  {MOTION_PACKS.map((p) => (
                    <Pill
                      key={p.key}
                      active={motionKey === p.key}
                      onClick={() => setMotionKey(p.key)}
                      title={p.blurb}
                    >
                      {p.name}
                    </Pill>
                  ))}
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Effect amount
                </p>
                <Slider
                  value={[effectAmount]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => setEffectAmount(v[0] ?? 5)}
                />
                <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span>Clean cuts</span>
                  <span>Full treatment</span>
                </div>
              </div>
            </div>



            <div className="mt-5 space-y-2 border-t border-border pt-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Style pack
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPackKey(null)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                    packKey === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  None
                </button>
                {STYLE_PACKS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPackKey(p.key)}
                    title={p.blurb}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                      packKey === p.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {audio?.beatMap && (
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={musicFirst}
                  onChange={(e) => setMusicFirst(e.target.checked)}
                />
                Build the edit around {audio.name} ({audio.beatMap.bpm} BPM)
              </label>
            )}

            <div className="mt-5">
              <PreviewReelControl />
            </div>

            <Button
              onClick={generate}
              disabled={busy}
              className="mt-6 h-14 w-full text-base font-extrabold uppercase tracking-[0.18em]"
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              Generate Templates
            </Button>
          </div>
        </section>
      </div>

      {generated.length > 0 && (
        <section id="results" className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="display-tight mb-8 text-2xl">Generated concepts</h2>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {generated.slice(0, 12).map((spec) => (
              <TemplateCard key={spec.id} spec={spec} onRegenerate={similar} onRemix={remix} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <h2 className="display-tight mr-4 text-2xl">Template library</h2>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs uppercase tracking-widest transition-colors ${
                c === category
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        {library.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {library.map((spec) => (
              <TemplateCard key={spec.id} spec={spec} onRegenerate={similar} onRemix={remix} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
