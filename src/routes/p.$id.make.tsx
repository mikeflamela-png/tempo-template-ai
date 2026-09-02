import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2, Music, Sparkles, Type as TypeIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { analyseAudio } from "@/lib/audio/beatmap";
import { putMedia, mediaUrl, cachedUrl } from "@/lib/footage/db";
import {
  DEFAULT_SETTINGS,
  projectById,
  projectClips,
  projectScenes,
  saveVersions,
  setLogo,
  setMusic,
  useFootage,
} from "@/lib/footage/store";
import {
  FORMATS,
  type EffectLevel,
  type FormatKey,
  type LogoMode,
  type LogoPosition,
  type MakeSettings,
  type TextPlacement,
  type TextSettings,
  type TextStyleKey,
} from "@/lib/footage/types";
import { addUploadedFont, useUploadedFonts } from "@/lib/footage/fonts";
import { FONTS } from "@/lib/template/fonts";
import { LOGO_KEY, buildVersions } from "@/lib/edit/build";
import { allRecipes, recipeByKey, saveRecipe } from "@/lib/edit/recipes";


export const Route = createFileRoute("/p/$id/make")({
  head: () => ({
    meta: [
      { title: "Make a video — Tempo" },
      { name: "description", content: "Pick music, length, format and a style, then generate several genuinely different edits." },
      { property: "og:title", content: "Make a video — Tempo" },
      { property: "og:description", content: "Music-driven edits built from your best footage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MakePage,
});

const LENGTHS = [10, 15, 30, 60];

function MakePage() {
  const { id } = useParams({ from: "/p/$id/make" });
  useFootage();
  const navigate = useNavigate();
  const project = projectById(id);
  const clips = projectClips(id);
  const scenes = projectScenes(id);
  const usable = clips.filter((c) => !c.rejected);
  const uploadedFonts = useUploadedFonts();

  const [settings, setSettings] = useState<MakeSettings>(
    project?.lastSettings ?? DEFAULT_SETTINGS,
  );
  const [analysing, setAnalysing] = useState(false);
  const [working, setWorking] = useState(false);
  const [custom, setCustom] = useState("");
  const audioInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const recipes = useMemo(() => allRecipes(), []);

  const logo = settings.logo ?? DEFAULT_SETTINGS.logo!;
  const text: TextSettings = settings.text ?? DEFAULT_SETTINGS.text!;

  const patch = (p: Partial<MakeSettings>) => setSettings((s) => ({ ...s, ...p }));
  const patchLogo = (p: Partial<typeof logo>) => patch({ logo: { ...logo, ...p } });
  const patchText = (p: Partial<TextSettings>) => patch({ text: { ...text, ...p } });

  const onLogo = async (file: File) => {
    const logoId = `logo-${Date.now().toString(36)}`;
    await putMedia(logoId, file);
    await mediaUrl(logoId);
    setLogo(id, { id: logoId, name: file.name, mime: file.type });
    if (logo.mode === "none") patchLogo({ mode: "outro" });
    toast.success("Logo added");
  };

  const onFont = async (file: File) => {
    try {
      const font = await addUploadedFont(file);
      patchText({ fontKey: font.key });
      toast.success(`${font.name} ready`);
    } catch {
      toast.error("Could not load that font file");
    }
  };

  const onAudio = async (file: File) => {
    setAnalysing(true);
    try {
      const musicId = `mus-${Date.now().toString(36)}`;
      await putMedia(musicId, file);
      await mediaUrl(musicId);
      const { beatMap, peaks } = await analyseAudio(file);
      setMusic(id, {
        id: musicId,
        name: file.name,
        duration: beatMap.duration,
        beatMap,
        peaks,
      });
      toast.success(`Analysed ${Math.round(beatMap.bpm)} BPM · ${beatMap.events.length} beats`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not analyse that track");
    } finally {
      setAnalysing(false);
    }
  };


  const generate = () => {
    if (!usable.length) {
      toast.error("Add and rate some footage first");
      return;
    }
    setWorking(true);
    setTimeout(() => {
      try {
        const versions = buildVersions(usable, settings, project?.music?.beatMap ?? null, {
          scenes,
          logoKey: project?.logo ? LOGO_KEY : null,
        });

        saveVersions(id, versions, settings);
        void navigate({ to: "/p/$id/results", params: { id } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not build the edits");
      } finally {
        setWorking(false);
      }
    }, 30);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section>
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Music</p>
        <input
          ref={audioInput}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onAudio(f);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/40 p-4">
          <Button variant="outline" onClick={() => audioInput.current?.click()} disabled={analysing}>
            {analysing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Music className="mr-2 size-4" />}
            {project?.music ? "Replace song" : "Upload song"}
          </Button>
          {project?.music ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{project.music.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {Math.round(project.music.beatMap?.bpm ?? 0)} BPM ·{" "}
                {project.music.beatMap?.events.length ?? 0} beats · {project.music.duration.toFixed(0)}s
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Optional — cuts land on beats when a track is loaded.</p>
          )}
        </div>
        {project?.music?.peaks?.length ? (
          <div className="mt-2 flex h-10 items-end gap-px overflow-hidden">
            {project.music.peaks
              .filter((_, i) => i % 3 === 0)
              .map((p, i) => (
                <span key={i} className="w-full bg-primary/40" style={{ height: `${Math.max(4, p * 100)}%` }} />
              ))}
          </div>
        ) : null}
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Length</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {LENGTHS.map((l) => (
            <button
              key={l}
              onClick={() => patch({ duration: l })}
              className={`rounded-xl border px-6 py-4 text-lg transition-colors ${
                settings.duration === l
                  ? "border-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {l} sec
            </button>
          ))}
          <div className="flex items-center gap-2 rounded-xl border border-border px-4">
            <input
              type="number"
              min={4}
              max={180}
              value={custom}
              placeholder="Custom"
              onChange={(e) => {
                setCustom(e.target.value);
                const v = Number(e.target.value);
                if (v >= 4 && v <= 180) patch({ duration: v });
              }}
              className="w-20 bg-transparent py-4 text-lg outline-none"
            />
            <span className="text-xs text-muted-foreground">sec</span>
          </div>
        </div>
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Format</p>
        <div className="mt-3 flex gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              onClick={() => patch({ format: f.key as FormatKey })}
              className={`rounded-xl border px-6 py-4 text-lg ${
                settings.format === f.key
                  ? "border-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Style</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {recipes.map((r) => (
            <button
              key={r.key}
              onClick={() => patch({ styleKey: r.key })}
              className={`rounded-xl border p-4 text-left transition-colors ${
                settings.styleKey === r.key
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/60"
              }`}
            >
              <p className="text-sm uppercase tracking-widest">{r.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{r.blurb}</p>
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const base = recipeByKey(settings.styleKey);
            const name = window.prompt("Name this editing style", `${base.name} preset`);
            if (!name) return;
            saveRecipe({ ...base, key: `saved-${Date.now().toString(36)}`, name, custom: true });
            toast.success("Style saved");
          }}
          className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          Save this style
        </button>
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Logo</p>
        <input
          ref={logoInput}
          type="file"
          accept="image/png,image/svg+xml,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onLogo(f);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/40 p-4">
          <Button variant="outline" onClick={() => logoInput.current?.click()}>
            <ImageIcon className="mr-2 size-4" />
            {project?.logo ? "Replace logo" : "Upload logo"}
          </Button>
          {project?.logo ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {cachedUrl(project.logo.id) ? (
                <img
                  src={cachedUrl(project.logo.id)!}
                  alt="Project logo"
                  className="h-8 w-auto max-w-24 object-contain"
                />
              ) : null}
              <p className="truncate text-xs text-muted-foreground">{project.logo.name}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Transparent PNG or SVG.</p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["none", "intro", "outro", "both", "watermark"] as LogoMode[]).map((m) => (
            <button
              key={m}
              onClick={() => patchLogo({ mode: m })}
              className={`rounded-xl border px-5 py-3 text-xs uppercase tracking-widest ${
                logo.mode === m
                  ? "border-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "both" ? "Intro + Outro" : m}
            </button>
          ))}
        </div>
        {logo.mode === "watermark" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              ["top-left", "top-right", "bottom-left", "bottom-right"] as LogoPosition[]
            ).map((p) => (
              <button
                key={p}
                onClick={() => patchLogo({ position: p })}
                className={`rounded-lg border px-3 py-2 text-[11px] ${
                  logo.position === p
                    ? "border-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.replace("-", " ")}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Text</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(
            [
              ["opening", "Opening text"],
              ["middle", "Middle text"],
              ["closing", "Closing text"],
            ] as const
          ).map(([key, label]) => (
            <input
              key={key}
              value={text[key]}
              placeholder={label}
              onChange={(e) => patchText({ [key]: e.target.value } as Partial<TextSettings>)}
              className="rounded-xl border border-border bg-card/40 px-4 py-3 text-sm outline-none focus:border-primary"
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["minimal", "editorial", "bold", "caption"] as TextStyleKey[]).map((s) => (
            <button
              key={s}
              onClick={() => patchText({ style: s })}
              className={`rounded-xl border px-5 py-3 text-xs uppercase tracking-widest ${
                text.style === s
                  ? "border-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
          <span className="mx-2 self-center text-[10px] uppercase tracking-widest text-muted-foreground">
            Placement
          </span>
          {(["top", "center", "bottom"] as TextPlacement[]).map((p) => (
            <button
              key={p}
              onClick={() => patchText({ placement: p })}
              className={`rounded-xl border px-5 py-3 text-xs uppercase tracking-widest ${
                text.placement === p
                  ? "border-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          ref={fontInput}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onFont(f);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={text.fontKey}
            onChange={(e) => patchText({ fontKey: e.target.value })}
            className="rounded-xl border border-border bg-card/40 px-4 py-3 text-sm outline-none"
          >
            {uploadedFonts.length ? (
              <optgroup label="Your fonts">
                {uploadedFonts.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="Library">
              {FONTS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          </select>
          <Button variant="ghost" size="sm" onClick={() => fontInput.current?.click()}>
            <TypeIcon className="mr-2 size-4" />
            Upload font
          </Button>
        </div>
      </section>



      <section>
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Effects</p>
        <div className="mt-3 flex gap-2">
          {(["none", "light", "medium"] as EffectLevel[]).map((e) => (
            <button
              key={e}
              onClick={() => patch({ effects: e })}
              className={`rounded-xl border px-6 py-3 text-sm uppercase tracking-widest ${
                settings.effects === e
                  ? "border-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Number of edits</p>
        <div className="mt-3 flex gap-2">
          {[3, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => patch({ count: n })}
              className={`rounded-xl border px-8 py-3 text-lg ${
                settings.count === n
                  ? "border-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 flex items-center gap-4 rounded-2xl border border-border bg-card/90 p-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {usable.length} clips available · {usable.filter((c) => c.rating >= 4).length} rated 4★+
          </p>
          {!usable.length && (
            <Link to="/p/$id/footage" params={{ id }} className="text-xs text-primary">
              Upload footage first
            </Link>
          )}
        </div>
        <Button size="lg" onClick={generate} disabled={working || !usable.length} className="gap-2">
          {working ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Generate edits
        </Button>
      </div>
    </div>
  );
}
