import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TemplateCard } from "@/components/TemplateCard";
import { LAYOUT_BOXES, LAYOUT_GROUPS } from "@/lib/template/layouts";
import { GRAPHICS } from "@/lib/template/graphics";
import { RHYTHMS } from "@/lib/template/rhythm";
import { FONTS, FONT_CATEGORIES } from "@/lib/template/fonts";
import { STYLE_PACKS } from "@/lib/template/stylepacks";
import { CONCEPTS } from "@/lib/template/concepts";
import { ANIMATIONS, TRANSITIONS, type Layout } from "@/lib/template/types";
import { generateTemplates } from "@/lib/template/generate";
import { addGenerated, useTemplateStore } from "@/lib/template/store";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Creative library — Tempo" },
      {
        name: "description",
        content:
          "Browse every editing primitive Tempo builds with: layouts, motion, transitions, typography, graphics, fonts and style packs.",
      },
      { property: "og:title", content: "Creative library — Tempo" },
      {
        property: "og:description",
        content: "Every layout, transition, motion and typography primitive in the Tempo engine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

const TABS = [
  "Layouts",
  "Motion",
  "Transitions",
  "Graphics",
  "Rhythms",
  "Fonts",
  "Style packs",
  "Concepts",
  "Creative Lab",
] as const;

function LayoutThumb({ layout }: { layout: Layout }) {
  const b = LAYOUT_BOXES[layout];
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-md border border-border bg-muted/30">
      <div
        className="absolute bg-primary/70"
        style={{
          left: b.left,
          top: b.top,
          width: b.width,
          height: b.height,
          clipPath: b.clip,
          borderRadius: b.radius,
          transform: b.rotate ? `rotate(${b.rotate}deg)` : undefined,
        }}
      />
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{children}</div>;
}

function Tile({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="truncate text-sm font-semibold">{title}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function LibraryPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Layouts");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const { generated } = useTemplateStore();
  const [experiments, setExperiments] = useState<string[]>([]);

  const runExperiment = () => {
    setBusy(true);
    setTimeout(() => {
      const specs = generateTemplates(
        {
          prompt: prompt || "An experiment: break the grid, unexpected cutting, one huge word.",
          platform: "Reels",
          duration: 10,
          format: "9:16",
          energy: "High",
          complexity: "Complex",
          risk: 9,
        },
        3,
      );
      addGenerated(specs);
      setExperiments((prev) => [...specs.map((s) => s.id), ...prev]);
      setBusy(false);
    }, 400);
  };

  const experimentSpecs = generated.filter((g) => experiments.includes(g.id));

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="size-4" /> Tempo
          </Link>
        </Button>
        <h1 className="display-tight text-base">Creative library</h1>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3.5 py-1.5 text-xs uppercase tracking-widest transition-colors ${
                t === tab
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Layouts" && (
          <div className="space-y-10">
            {Object.entries(LAYOUT_GROUPS).map(([group, layouts]) => (
              <section key={group}>
                <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {group.replace(/([a-z])([A-Z])/g, "$1 $2")}
                </h2>
                <Grid>
                  {(layouts as readonly Layout[]).map((l) => (
                    <div key={l} className="space-y-1.5">
                      <LayoutThumb layout={l} />
                      <p className="text-[11px] text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </Grid>
              </section>
            ))}
          </div>
        )}

        {tab === "Motion" && (
          <Grid>
            {ANIMATIONS.map((a) => (
              <Tile key={a} title={a.replace(/_/g, " ")} sub="motion primitive" />
            ))}
          </Grid>
        )}

        {tab === "Transitions" && (
          <Grid>
            {TRANSITIONS.map((t) => (
              <Tile key={t} title={t.replace(/_/g, " ")} sub="shot change" />
            ))}
          </Grid>
        )}

        {tab === "Graphics" && (
          <Grid>
            {GRAPHICS.map((g) => (
              <Tile key={g.kind} title={g.name} sub={`${g.group} · ${g.defaultAnimation}`} />
            ))}
          </Grid>
        )}

        {tab === "Rhythms" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RHYTHMS.map((r) => (
              <div key={r.key} className="rounded-xl border border-border p-4">
                <p className="text-sm font-semibold uppercase tracking-wider">{r.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                <div className="mt-3 flex h-6 gap-0.5">
                  {r.weights(r.density).map((w, i) => (
                    <div key={i} className="bg-primary/70" style={{ flex: w }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Fonts" && (
          <div className="space-y-8">
            {FONT_CATEGORIES.map((cat) => (
              <section key={cat}>
                <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {cat}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {FONTS.filter((f) => f.category === cat).map((f) => (
                    <div key={f.key} className="rounded-xl border border-border p-4">
                      <p className="text-2xl" style={{ fontFamily: f.stack }}>
                        Tempo Aa
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{f.name}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {tab === "Style packs" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STYLE_PACKS.map((p) => (
              <div key={p.key} className="overflow-hidden rounded-xl border border-border">
                <div
                  className="flex h-28 items-end p-3"
                  style={{ background: p.palette.bg, color: p.palette.ink }}
                >
                  <span className="text-sm" style={{ color: p.palette.accent }}>
                    {p.name}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground">{p.blurb}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {p.overlays.join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Concepts" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONCEPTS.map((c) => (
              <div key={c.key} className="rounded-xl border border-border p-4">
                <p className="text-sm font-semibold">{c.names[0]}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.idea}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "Creative Lab" && (
          <div className="space-y-8">
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Editing experiment
              </p>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. cut only on the downbeat, hold one frame for a full second, then a giant word"
                className="mt-3 min-h-24 resize-none"
              />
              <Button onClick={runExperiment} disabled={busy} className="mt-4">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
                Run experiment
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Experiments run at max creative risk and are saved into your template library.
              </p>
            </div>
            {experimentSpecs.length > 0 && (
              <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
                {experimentSpecs.map((s) => (
                  <TemplateCard key={s.id} spec={s} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
